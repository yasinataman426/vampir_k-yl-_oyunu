import React, { useEffect, useState } from 'react';
import { Player } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { AVATARS } from '@/lib/constants';

interface DayPhaseProps {
  room: any;
  me: Player;
  alivePlayers: Player[];
  allPlayers: Player[];
}

export const DayPhase: React.FC<DayPhaseProps> = ({ room, me, alivePlayers, allPlayers }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!room.phase_ends_at) return;
    
    const interval = setInterval(() => {
      const endsAt = new Date(room.phase_ends_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
      setTimeLeft(diff);

      // Auto-trigger voting when time runs out (only host sends the command to avoid spam)
      if (diff === 0 && me.is_host) {
        handleStartVoting();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room.phase_ends_at, me.is_host]);

  const handleStartVoting = async () => {
    try {
      await supabase.from('rooms').update({ phase: 'voting' }).eq('id', room.id);
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const killedNames = room.last_killed_nicknames || [];

  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full items-center animate-in fade-in duration-500">
      
      {/* Timer Top Center */}
      {room.phase_ends_at && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-panel px-6 py-2 rounded-full border-secondary shadow-[0_0_15px_rgba(212,175,55,0.5)] flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
          <span className="text-xl font-serif text-white tracking-widest">{formatTime(timeLeft)}</span>
        </div>
      )}

      {/* Moderatör Mesajı (Killed Log) - MINIMAL */}
      <div className="w-full mb-2">
        {killedNames.length === 0 ? (
          <div className="glass-panel border-green-500/30 px-4 py-2 rounded-lg flex items-center justify-center gap-2">
            <span className="text-green-400 text-sm">✓</span>
            <p className="text-gray-300 text-sm">Dün gece kimse ölmedi.</p>
          </div>
        ) : (
          <div className="glass-panel border-primary/30 px-4 py-2 rounded-lg flex items-center justify-center gap-2 flex-wrap">
            <span className="text-primary text-sm font-bold">☠ Dün gece ölenler:</span>
            <div className="flex gap-1 flex-wrap">
              {killedNames.map((name: string, i: number) => (
                <span key={i} className="text-gray-300 text-sm font-medium">
                  {name}{i < killedNames.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-4 md:p-6 rounded-xl w-full mb-2 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-2">
          <div className="text-center md:text-left">
            <h2 className="text-xl md:text-2xl font-serif text-white mb-0.5">Gündüz Tartışması</h2>
            <p className="text-gray-400 text-xs md:text-sm">Kimlerin şüpheli olduğunu tartışın. Süre bitince oylama başlayacak.</p>
          </div>
          
          {me.is_host && (
            <button
              onClick={handleStartVoting}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-red-700 text-white shadow-[0_0_10px_rgba(139,0,0,0.5)] transition-colors shrink-0"
            >
              Oylamaya Geç
            </button>
          )}
        </div>

        {/* Player List */}
        <div className="w-full text-left">
          <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-1">
            <h3 className="text-base font-serif text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Hayatta Kalanlar
            </h3>
            <span className="text-gray-400 text-xs">{alivePlayers.length} Kişi</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
            {allPlayers.filter(p => p.is_alive).map(player => {
              const avatar = AVATARS.find(a => a.id === player.avatar_id);
              return (
                <div key={player.id} className="glass-panel p-3 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-white/20 shrink-0">
                    {avatar ? <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" /> : <span className="text-white flex items-center justify-center w-full h-full text-xs">{player.nickname[0].toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium truncate text-sm ${me.role === 'Vampir' && player.role === 'Vampir' ? 'text-red-500 font-bold' : 'text-white'}`}>
                      {player.nickname}
                    </p>
                    {me.role === 'Vampir' && player.role === 'Vampir' && <p className="text-[10px] text-red-400 mt-0.5 leading-none">(Vampir)</p>}
                    {player.id === me.id && <p className="text-[10px] text-secondary mt-0.5 leading-none">Sen</p>}
                  </div>
                </div>
              );
            })}
          </div>
          
          {allPlayers.filter(p => !p.is_alive).length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2 border-b border-red-900/50 pb-1 mt-4">
                <h3 className="text-sm font-serif text-gray-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-900"></span> Ölenler
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 opacity-60 grayscale">
                {allPlayers.filter(p => !p.is_alive).map(player => {
                  const avatar = AVATARS.find(a => a.id === player.avatar_id);
                  return (
                    <div key={player.id} className="glass-panel p-2 rounded-lg flex items-center gap-3 bg-black/60 relative border-red-900/30">
                      <div className="absolute left-[1.1rem] top-1/2 -translate-y-1/2 flex items-center justify-center text-red-500 font-bold text-3xl z-10 drop-shadow-[0_0_2px_rgba(0,0,0,1)]">
                        ×
                      </div>
                      <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-red-900 shrink-0 opacity-40">
                        {avatar ? <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" /> : null}
                      </div>
                      <span className="font-medium text-gray-400 line-through truncate text-xs">{player.nickname}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
