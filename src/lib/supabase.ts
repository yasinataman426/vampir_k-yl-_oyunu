import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Player = {
  id: string;
  room_id: string;
  nickname: string;
  avatar_id: string;
  role: string | null;
  is_alive: boolean;
  is_host: boolean;
  joined_at: string;
};

export type Room = {
  id: string;
  room_code: string;
  timer_setting: number;
  is_active: boolean;
  phase: string;
  created_at: string;
};
