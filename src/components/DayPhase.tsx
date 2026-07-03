import React, { useEffect, useState } from 'react';
import { Player } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';

interface DayPhaseProps {
  room: any;
  me: Player;
  alivePlayers: Player[];
}

export const DayPhase: React.FC<DayPhaseProps> = ({ room, me, alivePlayers }) => {
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
    <div className="flex flex-col max-w-3xl mx-auto w-full items-center animate-in fade-in duration-500">
      
      {/* Moderatör Mesajı (Killed Log) */}
      <div className="w-full mb-10 text-center">
        {killedNames.length === 0 ? (
          <div className="glass-panel border-green-500/50 p-6 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.1)] inline-block">
            <h3 className="text-2xl font-serif text-white">Kasaba Huzur İçinde Uyandı</h3>
            <p className="text-gray-400 mt-2">Dün gece kimse ölmedi.</p>
          </div>
        ) : (
          <div className="glass-panel border-primary/50 p-6 rounded-2xl shadow-[0_0_30px_rgba(139,0,0,0.2)] inline-block w-full">
            <h3 className="text-2xl font-serif text-primary mb-2">Kasabada Kan Döküldü</h3>
            <p className="text-gray-300">Dün gece öldürülenler:</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {killedNames.map((name: string, i: number) => (
                <span key={i} className="px-4 py-2 bg-black/50 border border-primary/30 rounded-lg text-white font-medium">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-8 rounded-xl text-center w-full mb-8 relative overflow-hidden">
        <h2 className="text-3xl font-serif text-white mb-2">Gündüz Tartışması</h2>
        <p className="text-gray-400 mb-8">Kimlerin şüpheli olduğunu tartışın. Süre bitince oylama başlayacak.</p>
        
        {/* Timer */}
        {room.phase_ends_at && (
          <div className="text-6xl font-serif tracking-widest text-secondary drop-shadow-[0_0_15px_rgba(212,175,55,0.4)] mb-4">
            {formatTime(timeLeft)}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-8 p-4 bg-black/40 rounded-lg border border-white/5 inline-flex mx-auto">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <p className="text-sm text-gray-400">Hayatta Kalanlar: <span className="text-white font-bold">{alivePlayers.length}</span></p>
        </div>
      </div>

      {me.is_host && (
        <Button variant="secondary" onClick={handleStartVoting} className="w-full max-w-sm mt-4">
          Moderatör: Süreyi Bitir & Oylamaya Geç
        </Button>
      )}
    </div>
  );
};
