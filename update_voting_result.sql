-- Sütun eklentisi
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS last_hung_nickname text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS night_timer_setting integer DEFAULT 30;

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
    -- 1. En çok oyu alanları bul
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

    -- 2. Eğer sadece 1 kişi en çok oyu aldıysa onu seç (Beraberlik yoksa)
    IF array_length(v_tied_targets, 1) = 1 THEN
        v_most_voted := v_tied_targets[1];
    ELSE
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
    
    DELETE FROM public.votes WHERE room_id = p_room_id;
    
    -- 6. Oylama bittiğinde kazanma durumunu kontrol et
    PERFORM public.check_win_condition(p_room_id);
END;
$function$;
