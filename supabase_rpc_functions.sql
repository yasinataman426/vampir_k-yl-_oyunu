-- 1. Önceki kafa karıştırıcı kopyaları temizleyelim
DROP FUNCTION IF EXISTS public.assign_roles_batch(text, jsonb);
DROP FUNCTION IF EXISTS public.assign_roles_batch(uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_game_state(text);
DROP FUNCTION IF EXISTS public.get_game_state(uuid);
DROP FUNCTION IF EXISTS public.investigate_player(text, text);
DROP FUNCTION IF EXISTS public.investigate_player(uuid, uuid);
DROP FUNCTION IF EXISTS public.process_night(text);
DROP FUNCTION IF EXISTS public.process_night(uuid);
DROP FUNCTION IF EXISTS public.process_voting(text);
DROP FUNCTION IF EXISTS public.process_voting(uuid);
DROP FUNCTION IF EXISTS public.check_win_condition(uuid);

-- 2. Doğru parametrelerle (uuid) yeniden oluşturalım

-- check_win_condition (Oyun Bitiş Kontrolü)
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

-- assign_roles_batch
CREATE OR REPLACE FUNCTION public.assign_roles_batch(
    p_room_id uuid,
    p_assignments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    assignment jsonb;
BEGIN
    FOR assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
        UPDATE public.players
        SET role = assignment->>'role'
        WHERE id = (assignment->>'player_id')::uuid;
    END LOOP;

    UPDATE public.rooms
    SET is_active = true, phase = 'day'
    WHERE id = p_room_id;
END;
$function$;

-- get_game_state (SETOF public.players kullanarak %100 Tip Uyumlu)
CREATE OR REPLACE FUNCTION public.get_game_state(p_player_id uuid)
RETURNS SETOF public.players
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_room_id uuid;
    v_requester_role text;
    r public.players%ROWTYPE;
BEGIN
    SELECT p.room_id, p.role INTO v_room_id, v_requester_role
    FROM public.players p
    WHERE p.id = p_player_id;

    FOR r IN SELECT * FROM public.players WHERE room_id = v_room_id
    LOOP
        -- Eğer bakan kişi kendisi değilse ve Vampir->Vampir'e bakmıyorsa rolü gizle
        IF r.id != p_player_id AND NOT (v_requester_role = 'Vampir' AND r.role = 'Vampir') THEN
            r.role := NULL;
        END IF;
        
        RETURN NEXT r;
    END LOOP;
    
    RETURN;
END;
$function$;

-- investigate_player (Avcı için)
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

-- process_night (Geceyi bitirme)
CREATE OR REPLACE FUNCTION public.process_night(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_killed_by_vampire uuid;
    v_healed uuid;
    v_killed_by_shooter uuid;
    v_shooter_id uuid;
    v_shooter_target_role text;
    dead_players uuid[] := '{}';
    dead_nicknames text[] := '{}';
    p_record RECORD;
BEGIN
    SELECT target_id INTO v_killed_by_vampire FROM public.night_actions WHERE room_id = p_room_id AND action_type = 'kill' LIMIT 1;
    SELECT target_id INTO v_healed FROM public.night_actions WHERE room_id = p_room_id AND action_type = 'heal' LIMIT 1;
    SELECT player_id, target_id INTO v_shooter_id, v_killed_by_shooter FROM public.night_actions WHERE room_id = p_room_id AND action_type = 'shoot' LIMIT 1;

    IF v_killed_by_vampire IS NOT NULL AND (v_healed IS NULL OR v_healed != v_killed_by_vampire) THEN
        dead_players := array_append(dead_players, v_killed_by_vampire);
    END IF;

    IF v_killed_by_shooter IS NOT NULL THEN
        SELECT role INTO v_shooter_target_role FROM public.players WHERE id = v_killed_by_shooter;
        dead_players := array_append(dead_players, v_killed_by_shooter);
        IF v_shooter_target_role != 'Vampir' THEN
            dead_players := array_append(dead_players, v_shooter_id);
        END IF;
    END IF;

    IF array_length(dead_players, 1) > 0 THEN
        FOR p_record IN 
            UPDATE public.players SET is_alive = false WHERE id = ANY(dead_players) RETURNING nickname
        LOOP
            dead_nicknames := array_append(dead_nicknames, p_record.nickname);
        END LOOP;
    END IF;

    UPDATE public.rooms
    SET phase = 'day',
        last_killed_nicknames = dead_nicknames
    WHERE id = p_room_id;

    DELETE FROM public.night_actions WHERE room_id = p_room_id;
    
    -- Gece bittiğinde kazanma durumunu kontrol et
    PERFORM public.check_win_condition(p_room_id);
END;
$function$;

-- process_voting (Oylamayı bitirme)
CREATE OR REPLACE FUNCTION public.process_voting(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_most_voted uuid;
    v_voted_role text;
BEGIN
    SELECT target_id INTO v_most_voted
    FROM public.votes
    WHERE room_id = p_room_id AND target_id IS NOT NULL
    GROUP BY target_id
    ORDER BY count(*) DESC
    LIMIT 1;

    IF v_most_voted IS NOT NULL THEN
        UPDATE public.players SET is_alive = false WHERE id = v_most_voted RETURNING role INTO v_voted_role;
        
        -- Eğer asılan kişi Soytarı ise oyun biter
        IF v_voted_role = 'Soytarı' THEN
            UPDATE public.rooms SET phase = 'endgame', winner = 'Jester' WHERE id = p_room_id;
            DELETE FROM public.votes WHERE room_id = p_room_id;
            RETURN;
        END IF;
    END IF;

    UPDATE public.rooms SET phase = 'night' WHERE id = p_room_id;
    DELETE FROM public.votes WHERE room_id = p_room_id;
    
    -- Oylama bittiğinde kazanma durumunu kontrol et
    PERFORM public.check_win_condition(p_room_id);
END;
$function$;
