import React, { useState, useEffect } from 'react';
import { Player } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { AVATARS } from '@/lib/constants';

interface Vote {
  id: string;
  room_id: string;
  voter_id: string;
  target_id: string | null;
  created_at: string;
}

interface VotingPhaseProps {
  room: any;
  me: Player;
  alivePlayers: Player[];
}

export const VotingPhase: React.FC<VotingPhaseProps> = ({ room, me, alivePlayers }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [currentVotes, setCurrentVotes] = useState<Vote[]>([]);

  useEffect(() => {
    let votesSub: any;

    const fetchVotesAndSubscribe = async () => {
      try {
        // Fetch initial votes
        const { data, error } = await supabase
          .from('votes')
          .select('*')
          .eq('room_id', room.id);
        
        if (error) throw error;
        setCurrentVotes(data || []);

        // Check if I have already voted
        const myVote = (data || []).find(v => v.voter_id === me.id);
        if (myVote) {
          setHasVoted(true);
        }

        // Subscribe to changes
        votesSub = supabase
          .channel(`votes_room_${room.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${room.id}` },
            (payload) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newVote = payload.new as Vote;
                setCurrentVotes(prev => {
                  const exists = prev.find(v => v.voter_id === newVote.voter_id);
                  if (exists) {
                    return prev.map(v => v.voter_id === newVote.voter_id ? newVote : v);
                  }
                  return [...prev, newVote];
                });
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Error fetching votes:', err);
      }
    };

    fetchVotesAndSubscribe();

    return () => {
      if (votesSub) supabase.removeChannel(votesSub);
    };
  }, [room.id, me.id]);

  if (hasVoted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-1000 text-center">
        <h2 className="text-3xl font-serif text-white mb-4">Oyunuz Kaydedildi</h2>
        <p className="text-gray-400">Diğer oyuncuların oy vermesini veya moderatörün oylamayı bitirmesini bekleyin.</p>
        
        <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl max-w-sm w-full">
          <h3 className="text-sm text-gray-400 uppercase tracking-widest mb-4">Canlı Oylama Durumu</h3>
          <div className="flex flex-col gap-3">
             {alivePlayers.filter(p => p.id !== me.id).map(player => {
                const votesForPlayer = currentVotes.filter(v => v.target_id === player.id);
                if (votesForPlayer.length === 0) return null;
                const playerAvatar = AVATARS.find(a => a.id === player.avatar_id);
                return (
                  <div key={player.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       {playerAvatar && (
                         <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-xs bg-white/5" title={playerAvatar.name}>
                           {playerAvatar.emoji}
                         </div>
                       )}
                       <span className="text-white text-sm">{player.nickname}</span>
                    </div>
                    <span className="text-primary font-bold">{votesForPlayer.length} Oy</span>
                  </div>
                );
             })}
          </div>
        </div>
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
        {validTargets.map(player => {
          const playerAvatar = AVATARS.find(a => a.id === player.avatar_id);
          const votesForPlayer = currentVotes.filter(v => v.target_id === player.id);
          
          return (
            <button
              key={player.id}
              onClick={() => setSelectedTarget(player.id)}
              className={`p-3 sm:p-4 rounded-xl border transition-all flex flex-col gap-2 ${
                selectedTarget === player.id
                  ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(139,0,0,0.3)]' 
                  : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 w-full">
                {playerAvatar && (
                  <div className="w-8 h-8 rounded-full border-2 border-white/20 shrink-0 flex items-center justify-center text-sm bg-white/5" title={playerAvatar.name}>
                    {playerAvatar.emoji}
                  </div>
                )}
                <span className="text-white font-medium text-left truncate">{player.nickname}</span>
              </div>
              
              {/* Voter Avatars list below the name */}
              {votesForPlayer.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 pl-11">
                  {votesForPlayer.map(vote => {
                    const voter = alivePlayers.find(p => p.id === vote.voter_id) || me;
                    const voterAvatar = AVATARS.find(a => a.id === voter.avatar_id);
                    if (!voterAvatar) return null;
                    return (
                      <div
                        key={vote.voter_id}
                        className="w-5 h-5 rounded-full border border-white/30 flex items-center justify-center text-[10px] bg-white/5"
                        title={voter.nickname}
                      >
                        {voterAvatar.emoji}
                      </div>);
                  })}
                </div>
              )}
            </button>
          );
        })}
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
