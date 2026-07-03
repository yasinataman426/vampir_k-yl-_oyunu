"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { supabase } from '@/lib/supabase';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || roomCode.trim().length !== 6) return;

    setIsLoading(true);
    setError('');

    try {
      const formattedCode = roomCode.trim().toUpperCase();

      // 1. Find Room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, is_active')
        .eq('room_code', formattedCode)
        .single();

      if (roomError || !roomData) {
        throw new Error('Oda bulunamadı! Lütfen kodu kontrol edin.');
      }

      if (roomData.is_active) {
        throw new Error('Oyun zaten başlamış, katılamazsınız.');
      }

      // 2. Insert Player
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: roomData.id,
          nickname: nickname.trim(),
          is_host: false,
          is_alive: true
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // 3. Store player id locally
      localStorage.setItem('vampir_player_id', playerData.id);

      // 4. Navigate to lobby
      router.push(`/lobby/${formattedCode}`);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Odaya katılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Odaya Katıl">
      <form onSubmit={handleJoin} className="space-y-6">
        <div>
          <label htmlFor="nickname" className="block text-sm font-medium text-gray-300 mb-2">
            Oyun İçi İsminiz
          </label>
          <input
            type="text"
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="Örn: Gece Avcısı"
            required
            maxLength={20}
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300 mb-2">
            6 Haneli Oda Kodu
          </label>
          <input
            type="text"
            id="roomCode"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-center tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono"
            placeholder="XXXXXX"
            required
            maxLength={6}
            minLength={6}
            disabled={isLoading}
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <Button type="submit" fullWidth variant="secondary" disabled={isLoading}>
          {isLoading ? 'Katılınıyor...' : 'Gizeme Katıl'}
        </Button>
      </form>
    </Modal>
  );
};
