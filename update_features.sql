-- 1. Add night_timer_setting to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS night_timer_setting integer DEFAULT 30;

-- 2. Update process_voting to handle ties and calculate night phase_ends_at
CREATE OR REPLACE FUNCTION public.process_voting(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_most_voted uuid;
    v_voted_role text;
    v_night_timer integer;
BEGIN
    -- Tie-breaker logic: only select if exactly 1 person has the maximum votes
    WITH VoteCounts AS (
        SELECT target_id, count(*) as c
        FROM public.votes
        WHERE room_id = p_room_id AND target_id IS NOT NULL
        GROUP BY target_id
    ), MaxVote AS (
        SELECT max(c) as max_c FROM VoteCounts
    ), TiedTargets AS (
        SELECT target_id
        FROM VoteCounts, MaxVote
        WHERE c = max_c
    )
    SELECT CASE WHEN (SELECT count(*) FROM TiedTargets) = 1 
                THEN (SELECT target_id FROM TiedTargets LIMIT 1) 
                ELSE NULL 
           END INTO v_most_voted;

    IF v_most_voted IS NOT NULL THEN
        UPDATE public.players SET is_alive = false WHERE id = v_most_voted RETURNING role INTO v_voted_role;
        
        -- Eğer asılan kişi Soytarı ise oyun biter
        IF v_voted_role = 'Soytarı' THEN
            UPDATE public.rooms SET phase = 'endgame', winner = 'Jester' WHERE id = p_room_id;
            DELETE FROM public.votes WHERE room_id = p_room_id;
            RETURN;
        END IF;
    END IF;

    -- Gece süresini al
    SELECT COALESCE(night_timer_setting, 30) INTO v_night_timer FROM public.rooms WHERE id = p_room_id;

    UPDATE public.rooms 
    SET phase = 'night',
        phase_ends_at = NOW() + (v_night_timer || ' seconds')::interval
    WHERE id = p_room_id;
    
    DELETE FROM public.votes WHERE room_id = p_room_id;
    
    -- Oylama bittiğinde kazanma durumunu kontrol et
    PERFORM public.check_win_condition(p_room_id);
END;
$function$;

-- 3. Update process_night to auto-select random target for Vampires if missing
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
BEGIN
    DECLARE
        v_tied_targets uuid[];
    BEGIN
        SELECT array_agg(target_id) INTO v_tied_targets
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

        IF array_length(v_tied_targets, 1) = 1 THEN
            v_vampire_target := v_tied_targets[1];
        ELSE
            v_vampire_target := NULL;
        END IF;
    END;

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

-- 4. Create check_pending_night_actions RPC
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
