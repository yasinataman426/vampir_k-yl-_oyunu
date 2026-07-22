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
    v_timer integer;
BEGIN
    FOR assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
        UPDATE public.players
        SET role = assignment->>'role'
        WHERE id = (assignment->>'player_id')::uuid;
    END LOOP;

    -- Süreyi al (timer_setting) veya varsayılan 60 sn ata
    SELECT COALESCE(timer_setting, 60) INTO v_timer FROM public.rooms WHERE id = p_room_id;

    -- Odayı aktifleştir, ilk gündüz fazını başlat ve bitiş süresini ayarla
    UPDATE public.rooms
    SET is_active = true, 
        phase = 'day',
        phase_ends_at = NOW() + (v_timer || ' minutes')::interval,
        last_killed_nicknames = '{}',
        last_hung_nickname = NULL
    WHERE id = p_room_id;
END;
$function$;
