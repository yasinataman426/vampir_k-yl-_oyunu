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
  const [isEnding, setIsEnding] = useState(false);

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
          setSelectedTarget(myVote.target_id);
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

  const handleEndVotingAuto = async () => {
    try {
      await supabase.rpc('process_voting', { p_room_id: room.id });
    } catch(e: any) {
      console.error(e);
      alert("Oylama hesaplanırken hata: " + e.message);
      setIsEnding(false);
    }
  };

  const validTargets = alivePlayers;
  return (
    <div className="flex flex-col max-w-6xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-serif text-white mb-0.5">Kimi Asalım?</h2>
          <p className="text-gray-400 text-xs md:text-sm">
            Tüm şüphelerinizi dinlediniz. Karar vakti.
            {me.is_host && <span className="ml-2 text-secondary font-medium">({currentVotes.length}/{alivePlayers.length} Oy)</span>}
          </p>
        </div>
        {me.is_host && (
          <button
            onClick={() => { setIsEnding(true); handleEndVotingAuto(); }}
            disabled={isEnding}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-red-700 text-white shadow-[0_0_10px_rgba(139,0,0,0.5)] transition-colors disabled:opacity-50"
          >
            {isEnding ? 'Bitiriliyor...' : 'Oylamayı Bitir'}
          </button>
        )}
      </div>

      {(!me.is_alive || hasVoted) && (
        <div className="mb-4 p-2 rounded-lg border border-secondary/50 bg-secondary/10 text-center flex items-center justify-center gap-2">
          <span className="text-sm font-serif text-secondary">
            {!me.is_alive ? 'İzleyici Modu' : 'Oyunuz Kaydedildi'}
          </span>
          <span className="text-xs text-gray-300">
            - {!me.is_alive ? 'Ölüler oy kullanamaz.' : 'Diğerlerini bekliyoruz.'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
        {validTargets.map(player => {
          const playerAvatar = AVATARS.find(a => a.id === player.avatar_id);
          const votesForPlayer = currentVotes.filter(v => v.target_id === player.id);
          
          return (
            <button
              key={player.id}
              onClick={() => setSelectedTarget(player.id)}
              disabled={!me.is_alive || hasVoted || player.id === me.id}
              className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                selectedTarget === player.id
                  ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(139,0,0,0.3)]' 
                  : 'bg-black/40 border-white/10'
              } ${(!me.is_alive || hasVoted) && selectedTarget !== player.id ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-3">
                {playerAvatar && (
                  <div className="w-8 h-8 rounded-full border border-white/20 shrink-0 bg-black overflow-hidden">
                    <img src={playerAvatar.src} alt={playerAvatar.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                  <span className={`text-sm truncate block font-medium ${me.role === 'Vampir' && player.role === 'Vampir' ? 'text-red-500 font-bold' : 'text-white'}`}>
                    {player.nickname}
                  </span>
                  {me.role === 'Vampir' && player.role === 'Vampir' && <span className="text-[10px] text-red-400 block -mt-1">(Vampir)</span>}
                  {player.id === me.id && <span className="text-[10px] text-secondary block -mt-1">Sen</span>}
                </div>
              </div>
              
              {votesForPlayer.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-11">
                  {votesForPlayer.map(vote => {
                    const voter = alivePlayers.find(p => p.id === vote.voter_id) || me;
                    const voterAvatar = AVATARS.find(a => a.id === voter.avatar_id);
                    if (!voterAvatar) return null;
                    return (
                      <div key={vote.voter_id} className="w-5 h-5 rounded-full bg-black overflow-hidden border border-white/20">
                        <img src={voterAvatar.src} className="w-full h-full object-cover" />
                      </div>);
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {me.is_alive && !hasVoted && (
        <div className="flex gap-2 items-center justify-center">
          <button
            onClick={() => setSelectedTarget(null)}
            className={`flex-1 max-w-[200px] py-2.5 rounded-lg text-sm font-medium border ${
              selectedTarget === null ? 'bg-white/20 border-white/40' : 'bg-black/40 border-white/10 text-gray-400'
            }`}
          >
            Pas Geç
          </button>

          <button
            onClick={handleVote}
            disabled={selectedTarget === undefined || isSubmitting}
            className="flex-1 max-w-[200px] py-2.5 rounded-lg text-sm font-medium bg-primary text-white border border-primary/50 hover:bg-primary-dark disabled:opacity-50 transition-all"
          >
            {isSubmitting ? '...' : 'Oyumu Onayla'}
          </button>
        </div>
      )}
    </div>
  );
};
