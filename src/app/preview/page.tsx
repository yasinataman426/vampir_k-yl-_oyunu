'use client';
import React, { useState } from 'react';
import { NightPhase } from '@/components/NightPhase';
import { DayPhase } from '@/components/DayPhase';
import { VotingPhase } from '@/components/VotingPhase';
import { EndGame } from '@/components/EndGame';

const MOCK_ME = { id: '1', nickname: 'Oyuncu (Sen)', is_alive: true, room_id: 'test', role: 'Vampir', is_host: true, joined_at: new Date().toISOString() };
const MOCK_PLAYERS = [
  MOCK_ME,
  { id: '2', nickname: 'Ahmet', is_alive: true, room_id: 'test', role: 'Köylü', is_host: false, joined_at: new Date().toISOString() },
  { id: '3', nickname: 'Mehmet', is_alive: true, room_id: 'test', role: 'Doktor', is_host: false, joined_at: new Date().toISOString() },
  { id: '4', nickname: 'Ayşe', is_alive: true, room_id: 'test', role: 'Köylü', is_host: false, joined_at: new Date().toISOString() },
  { id: '5', nickname: 'Fatma', is_alive: true, room_id: 'test', role: 'Silahşör', is_host: false, joined_at: new Date().toISOString() },
];

import { notFound } from 'next/navigation';

export default function PreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  const [phase, setPhase] = useState('night');
  const [role, setRole] = useState('Vampir');

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="mb-8 flex flex-col gap-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-serif text-primary">UI Tasarım Önizleme Modu</h1>
        
        <div className="flex gap-4 border-b border-white/10 pb-4">
          <button onClick={() => setPhase('night')} className={`px-4 py-2 rounded-lg ${phase === 'night' ? 'bg-primary text-white' : 'bg-white/5'}`}>Gece</button>
          <button onClick={() => setPhase('day')} className={`px-4 py-2 rounded-lg ${phase === 'day' ? 'bg-primary text-white' : 'bg-white/5'}`}>Gündüz</button>
          <button onClick={() => setPhase('voting')} className={`px-4 py-2 rounded-lg ${phase === 'voting' ? 'bg-primary text-white' : 'bg-white/5'}`}>Oylama</button>
          <button onClick={() => setPhase('endgame')} className={`px-4 py-2 rounded-lg ${phase === 'endgame' ? 'bg-primary text-white' : 'bg-white/5'}`}>Oyun Sonu</button>
        </div>

        {phase === 'night' && (
          <div className="flex gap-4">
            <span className="py-2 text-gray-400">Rol Değiştir:</span>
            {['Vampir', 'Doktor', 'Avcı', 'Silahşör', 'Köylü'].map(r => (
              <button key={r} onClick={() => setRole(r)} className={`px-3 py-1 rounded-full text-sm ${role === r ? 'bg-secondary text-white' : 'bg-white/10'}`}>
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border border-white/10 rounded-2xl p-8 max-w-4xl mx-auto relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black">
        {/* Mocking the container to look like the game area */}
        {phase === 'night' && (
          <NightPhase 
            room={{ id: 'test', phase: 'night' }} 
            me={MOCK_ME} 
            role={role} 
            teammates={role === 'Vampir' ? [{ id: '2', nickname: 'Ahmet' }] : []} 
            alivePlayers={MOCK_PLAYERS} 
          />
        )}
        
        {phase === 'day' && (
          <DayPhase 
            room={{ id: 'test', phase: 'day', last_killed_nicknames: ['Ayşe (Köylü)'] }} 
            me={MOCK_ME} 
            alivePlayers={MOCK_PLAYERS}
          />
        )}

        {phase === 'voting' && (
          <VotingPhase 
            room={{ id: 'test', phase: 'voting' }} 
            me={MOCK_ME} 
            alivePlayers={MOCK_PLAYERS} 
          />
        )}

        {phase === 'endgame' && (
          <EndGame 
            room={{ id: 'test', phase: 'endgame', winner: 'Vampires', last_killed_nicknames: ['Mehmet'] }} 
            me={MOCK_ME} 
          />
        )}
      </div>
    </div>
  );
}
