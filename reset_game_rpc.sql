CREATE OR REPLACE FUNCTION public.reset_game(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Reset the room to lobby state
    UPDATE public.rooms
    SET is_active = false,
        phase = 'day',
        winner = NULL,
        last_killed_nicknames = '{}'
    WHERE id = p_room_id;

    -- Revive all players and reset their roles
    UPDATE public.players
    SET is_alive = true,
        role = NULL
    WHERE room_id = p_room_id;

    -- Delete old votes
    DELETE FROM public.votes
    WHERE room_id = p_room_id;

    -- Delete old night actions
    DELETE FROM public.night_actions
    WHERE room_id = p_room_id;
END;
$$;
