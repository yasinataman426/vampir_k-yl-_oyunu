-- Sütun eklentileri (eğer yoksa)
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS last_hung_nickname text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS night_timer_setting integer DEFAULT 30;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS last_killed_nicknames text[] DEFAULT '{}';

-- 1. OYUN BİTİŞ KONTROLÜ
CREATE OR REPLACE FUNCTION public.check_win_condition(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_vampire_count int;
    v_villager_count int;
    v_phase text;
BEGIN
    SELECT phase INTO v_phase FROM public.rooms WHERE id = p_room_id;
    
    -- Eğer oyun zaten bittiyse (Soytarı kazanmış olabilir), tekrar kontrol etme
    IF v_phase = 'endgame' THEN
        RETURN;
    END IF;

    SELECT count(*) INTO v_vampire_count FROM public.players WHERE room_id = p_room_id AND is_alive = true AND role = 'Vampir';
    SELECT count(*) INTO v_villager_count FROM public.players WHERE room_id = p_room_id AND is_alive = true AND role != 'Vampir';

    IF v_vampire_count = 0 THEN
        UPDATE public.rooms SET phase = 'endgame', winner = 'Villagers' WHERE id = p_room_id;
    ELSIF v_vampire_count >= v_villager_count THEN
        UPDATE public.rooms SET phase = 'endgame', winner = 'Vampires' WHERE id = p_room_id;
    END IF;
END;
$function$;

-- 2. GÜNDÜZ OYLAMASI İŞLEME (TIE-BREAKER DÜZELTİLDİ)
CREATE OR REPLACE FUNCTION public.process_voting(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_most_voted uuid;
    v_voted_role text;
    v_hung_name text;
    v_night_timer integer;
    v_tied_targets uuid[];
BEGIN
    -- 1. En çok oyu alanları bul (Eğer birden fazla kişi aynı oyu aldıysa hepsi diziye atılır)
    SELECT array_agg(target_id) INTO v_tied_targets
    FROM (
        SELECT target_id
        FROM public.votes
        WHERE room_id = p_room_id AND target_id IS NOT NULL
        GROUP BY target_id
        HAVING count(*) = (
            SELECT max(c) FROM (
                SELECT count(*) as c
                FROM public.votes
                WHERE room_id = p_room_id AND target_id IS NOT NULL
                GROUP BY target_id
            ) sub
        )
    ) winners;

    -- 2. Eğer dizi uzunluğu tam 1 ise (yani sadece 1 kişi oylama birincisiyse) seç
    IF array_length(v_tied_targets, 1) = 1 THEN
        v_most_voted := v_tied_targets[1];
    ELSE
        -- Beraberlik varsa kimse asılmaz
        v_most_voted := NULL;
    END IF;

    -- 3. Biri seçildiyse onu as
    IF v_most_voted IS NOT NULL THEN
        UPDATE public.players SET is_alive = false WHERE id = v_most_voted RETURNING role, nickname INTO v_voted_role, v_hung_name;
        
        -- Eğer asılan kişi Soytarı ise oyun biter
        IF v_voted_role = 'Soytarı' THEN
            UPDATE public.rooms SET phase = 'endgame', winner = 'Jester', last_hung_nickname = v_hung_name WHERE id = p_room_id;
            DELETE FROM public.votes WHERE room_id = p_room_id;
            RETURN;
        END IF;
    ELSE
        v_hung_name := NULL;
    END IF;

    -- 4. Gece süresini al
    SELECT COALESCE(night_timer_setting, 30) INTO v_night_timer FROM public.rooms WHERE id = p_room_id;

    -- 5. Geceye geç
    UPDATE public.rooms 
    SET phase = 'night',
        phase_ends_at = NOW() + (v_night_timer || ' seconds')::interval,
        last_hung_nickname = v_hung_name
    WHERE id = p_room_id;
    
    -- Eski oyları sil
    DELETE FROM public.votes WHERE room_id = p_room_id;
    
    -- Oylama bittiğinde kazanma durumunu kontrol et
    PERFORM public.check_win_condition(p_room_id);
END;
$function$;

-- 3. GECE AKSİYONLARI İŞLEME (TIE-BREAKER DÜZELTİLDİ)
CREATE OR REPLACE FUNCTION public.process_night(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_vampire_target uuid;
    v_doctor_target uuid;
    v_gunner_target uuid;
    dead_nicknames text[] := '{}';
    v_target_name text;
    v_timer integer;
    v_vampire_count integer;
    v_total_vampire_votes integer;
    v_random_target uuid;
    v_tied_vampire_targets uuid[];
BEGIN
    -- Vampir hedefini bul (Beraberlik varsa kimse seçilmez)
    SELECT array_agg(target_id) INTO v_tied_vampire_targets
    FROM (
        SELECT target_id
        FROM public.night_actions
        WHERE room_id = p_room_id AND action_type = 'kill' AND target_id IS NOT NULL
        GROUP BY target_id
        HAVING count(*) = (
            SELECT max(c) FROM (
                SELECT count(*) as c
                FROM public.night_actions
                WHERE room_id = p_room_id AND action_type = 'kill' AND target_id IS NOT NULL
                GROUP BY target_id
            ) sub
        )
    ) winners;

    IF array_length(v_tied_vampire_targets, 1) = 1 THEN
        v_vampire_target := v_tied_vampire_targets[1];
    ELSE
        v_vampire_target := NULL;
    END IF;

    -- EĞER VAMPİRLER HİÇ HEDEF SEÇMEDİYSE (Süre bittiyse vs) VE YAŞAYAN VAMPİR VARSA
    SELECT count(*) INTO v_total_vampire_votes FROM public.night_actions WHERE room_id = p_room_id AND action_type = 'kill';
    SELECT count(*) INTO v_vampire_count FROM public.players WHERE room_id = p_room_id AND role = 'Vampir' AND is_alive = true;
    
    IF v_total_vampire_votes = 0 AND v_vampire_count > 0 THEN
        -- Rastgele bir kurban seç (Vampir olmayan ve yaşayan biri)
        SELECT id INTO v_random_target 
        FROM public.players 
        WHERE room_id = p_room_id AND role != 'Vampir' AND is_alive = true 
        ORDER BY random() 
        LIMIT 1;
        
        v_vampire_target := v_random_target;
    END IF;

    -- Doktor hedefini bul
    SELECT target_id INTO v_doctor_target
    FROM public.night_actions
    WHERE room_id = p_room_id AND action_type = 'heal'
    LIMIT 1;

    -- Silahşör hedefini bul
    SELECT target_id INTO v_gunner_target
    FROM public.night_actions
    WHERE room_id = p_room_id AND action_type = 'shoot'
    LIMIT 1;

    -- Doktor vampirin kurbanını korudu mu?
    IF v_vampire_target IS NOT NULL AND v_vampire_target != COALESCE(v_doctor_target, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        UPDATE public.players SET is_alive = false WHERE id = v_vampire_target;
        SELECT nickname INTO v_target_name FROM public.players WHERE id = v_vampire_target;
        dead_nicknames := array_append(dead_nicknames, v_target_name);
    END IF;

    -- Silahşör birini vurdu mu? (Doktor koruması işlemiyor)
    IF v_gunner_target IS NOT NULL THEN
        UPDATE public.players SET is_alive = false WHERE id = v_gunner_target;
        SELECT nickname INTO v_target_name FROM public.players WHERE id = v_gunner_target;
        dead_nicknames := array_append(dead_nicknames, v_target_name);
    END IF;

    -- Gece bitti, gündüz başlatılıyor (gündüz süresini hesapla)
    SELECT COALESCE(timer_setting, 60) INTO v_timer FROM public.rooms WHERE id = p_room_id;

    UPDATE public.rooms
    SET phase = 'day',
        last_killed_nicknames = dead_nicknames,
        phase_ends_at = NOW() + (v_timer || ' minutes')::interval
    WHERE id = p_room_id;

    DELETE FROM public.night_actions WHERE room_id = p_room_id;

    -- Gündüz başladığında birileri ölmüş olabilir, kazanma şartını kontrol et
    PERFORM public.check_win_condition(p_room_id);
END;
$function$;

-- 4. GECE AKSİYONU BEKLEYEN OYUNCULARI KONTROL ET
CREATE OR REPLACE FUNCTION public.check_pending_night_actions(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_vampire_alive integer;
    v_doctor_alive integer;
    v_vampire_acted integer;
    v_doctor_acted integer;
BEGIN
    -- Yaşayanları say
    SELECT count(*) INTO v_vampire_alive FROM public.players WHERE room_id = p_room_id AND role = 'Vampir' AND is_alive = true;
    SELECT count(*) INTO v_doctor_alive FROM public.players WHERE room_id = p_room_id AND role = 'Doktor' AND is_alive = true;

    -- Aksiyon alanları say
    SELECT count(*) INTO v_vampire_acted FROM public.night_actions WHERE room_id = p_room_id AND action_type = 'kill';
    SELECT count(*) INTO v_doctor_acted FROM public.night_actions WHERE room_id = p_room_id AND action_type = 'heal';
    
    RETURN jsonb_build_object(
        'vampires_pending', (v_vampire_alive > 0 AND v_vampire_acted = 0),
        'doctor_pending', (v_doctor_alive > 0 AND v_doctor_acted = 0)
    );
END;
$$;

-- 5. AVCI SORGUSU
CREATE OR REPLACE FUNCTION public.investigate_player(p_player_id uuid, p_target_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_requester_role text;
    v_target_role text;
BEGIN
    SELECT role INTO v_requester_role FROM public.players WHERE id = p_player_id;
    IF v_requester_role != 'Avcı' THEN
        RAISE EXCEPTION 'Sadece Avcı sorgu yapabilir!';
    END IF;

    SELECT role INTO v_target_role FROM public.players WHERE id = p_target_id;
    IF v_target_role = 'Vampir' THEN
        RETURN 'Vampir';
    ELSE
        RETURN 'Vampir Değil';
    END IF;
END;
$function$;

-- 6. OYUN DURUMUNU GETİR (OYUN BİTTİYSE ROLLERİ AÇ)
CREATE OR REPLACE FUNCTION public.get_game_state(p_player_id uuid)
RETURNS SETOF public.players
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_room_id uuid;
    v_requester_role text;
    v_phase text;
    r public.players%ROWTYPE;
BEGIN
    SELECT p.room_id, p.role INTO v_room_id, v_requester_role
    FROM public.players p
    WHERE p.id = p_player_id;

    SELECT phase INTO v_phase FROM public.rooms WHERE id = v_room_id;

    FOR r IN SELECT * FROM public.players WHERE room_id = v_room_id
    LOOP
        -- Eğer oyun bitmediyse ve bakan kişi kendisi değilse, ekstra bir de Vampir->Vampir değilse rolü GİZLE
        IF v_phase != 'endgame' AND r.id != p_player_id AND NOT (v_requester_role = 'Vampir' AND r.role = 'Vampir') THEN
            r.role := NULL;
        END IF;
        
        RETURN NEXT r;
    END LOOP;
    
    RETURN;
END;
$function$;
