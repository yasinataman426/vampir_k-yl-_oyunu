"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { supabase } from '@/lib/supabase';
import { AVATARS } from '@/lib/constants';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [discussionTime, setDiscussionTime] = useState('2');
  const [selectedAvatar, setSelectedAvatar] = useState('aslan');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const roomCode = generateRoomCode();
      
      // 1. Create Room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_code: roomCode,
          timer_setting: parseInt(discussionTime),
          is_active: false,
          phase: 'day'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // 2. Create Player (Host)
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: roomData.id,
          nickname: nickname.trim(),
          avatar_id: selectedAvatar,
          is_host: true,
          is_alive: true
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // 3. Store player id locally (simple approach for now)
      localStorage.setItem('vampir_player_id', playerData.id);

      // 4. Navigate to lobby
      router.push(`/lobby/${roomCode}`);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Oda oluşturulurken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Oda Kur">
      <form onSubmit={handleCreate} className="space-y-6">
        <div>
          <label htmlFor="host-nickname" className="block text-sm font-medium text-gray-300 mb-2">
            Kurucu İsminiz
          </label>
          <input
            type="text"
            id="host-nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="Örn: Kasaba Lideri"
            required
            maxLength={20}
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Figürünüzü Seçin
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setSelectedAvatar(avatar.id)}
                className={`shrink-0 w-12 h-12 rounded-full border-2 transition-all p-0.5 ${
                  selectedAvatar === avatar.id
                    ? 'border-primary scale-110 shadow-[0_0_10px_rgba(139,0,0,0.5)] bg-primary/20'
                    : 'border-transparent hover:border-white/30 hover:bg-white/10'
                }`}
                title={avatar.name}
              >
                <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-2xl">
                  {avatar.emoji}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tartışma Süresi
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3'].map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setDiscussionTime(time)}
                disabled={isLoading}
                className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                  discussionTime === time 
                    ? 'bg-secondary text-black border-secondary shadow-[0_0_10px_rgba(212,175,55,0.4)]' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                } disabled:opacity-50`}
              >
                {time} Dk
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <Button type="submit" fullWidth variant="primary" disabled={isLoading}>
          {isLoading ? 'Oluşturuluyor...' : 'Odayı Yarat'}
        </Button>
      </form>
    </Modal>
  );
};
