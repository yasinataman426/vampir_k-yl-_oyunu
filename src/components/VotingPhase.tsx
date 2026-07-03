import React, { useState } from 'react';
import { Player } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

interface VotingPhaseProps {
  room: any;
  me: Player;
  alivePlayers: Player[];
}

export const VotingPhase: React.FC<VotingPhaseProps> = ({ room, me, alivePlayers }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  if (hasVoted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-1000 text-center">
        <h2 className="text-3xl font-serif text-white mb-4">Oyunuz Kaydedildi</h2>
        <p className="text-gray-400">Diğer oyuncuların oy vermesini veya moderatörün oylamayı bitirmesini bekleyin.</p>
      </div>
    );
  }

  const handleVote = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('votes').insert({
        room_id: room.id,
        voter_id: me.id,
        target_id: selectedTarget // null if skip
      });
      if (error) throw error;
      setHasVoted(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Oy kullanılamadı.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validTargets = alivePlayers.filter(p => p.id !== me.id);

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full animate-in fade-in duration-500">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif text-white mb-2">Kasaba Oylaması (Linç)</h2>
        <p className="text-gray-400">Kasabadan birini asmak için oy verin veya pas geçin.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {validTargets.map(player => (
          <button
            key={player.id}
            onClick={() => setSelectedTarget(player.id)}
            className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
              selectedTarget === player.id
                ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(139,0,0,0.3)]' 
                : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <span className="text-white font-medium">{player.nickname}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 items-center">
        <button
          onClick={() => setSelectedTarget(null)}
          className={`w-full max-w-md py-4 rounded-lg font-medium transition-all ${
            selectedTarget === null
              ? 'bg-white/20 text-white border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
              : 'bg-black/40 border-white/10 hover:bg-white/10 text-gray-400'
          } border`}
        >
          Boş Oy (Pas Geç)
        </button>

        <button
          onClick={handleVote}
          disabled={isSubmitting || selectedTarget === undefined}
          className="w-full max-w-md py-4 rounded-lg font-medium bg-primary text-white border border-primary/50 hover:bg-primary-dark disabled:opacity-50 transition-all mt-4"
        >
          {isSubmitting ? 'İşleniyor...' : 'Oyumu Onayla'}
        </button>
      </div>
    </div>
  );
};
