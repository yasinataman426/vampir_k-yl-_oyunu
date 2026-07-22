import React, { useState, useEffect } from 'react';
import { Player } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { AVATARS } from '@/lib/constants';

interface NightPhaseProps {
  room: any;
  me: Player;
  role: string;
  teammates: any[];
  alivePlayers: Player[];
}

export const NightPhase: React.FC<NightPhaseProps> = ({ room, me, role, teammates, alivePlayers }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasActed, setHasActed] = useState(false);
  const [investigateResult, setInvestigateResult] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState(false);
  const [vampireSelections, setVampireSelections] = useState<Record<string, string>>({});
  const [channel, setChannel] = useState<any>(null);

  const [hasShot, setHasShot] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('has_shot') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (role !== 'Vampir' || !me.is_alive) return;

    const newChannel = supabase.channel(`room:${room.id}:vampires`);
    
    newChannel
      .on('broadcast', { event: 'vampire_hover' }, (payload) => {
        const { vampireId, targetId } = payload.payload;
        setVampireSelections(prev => ({ ...prev, [vampireId]: targetId }));
      })
      .subscribe();

    setChannel(newChannel);

    return () => {
      newChannel.unsubscribe();
    };
  }, [room.id, role, me.is_alive]);

  const handleEndNightAuto = async () => {
    try {
      await supabase.rpc('process_night', { p_room_id: room.id });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!room.phase_ends_at) return;
    
    const interval = setInterval(() => {
      const endsAt = new Date(room.phase_ends_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0 && me.is_host && !isEnding) {
        setIsEnding(true);
        handleEndNightAuto();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room.phase_ends_at, me.is_host, isEnding]);

  useEffect(() => {
    if (!me.is_host) return;
    
    // Poll for pending actions every 2 seconds
    const checkPending = async () => {
      try {
        const { data, error } = await supabase.rpc('check_pending_night_actions', { p_room_id: room.id });
        if (!error && data) {
          setPendingActions(data.vampires_pending || data.doctor_pending);
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    checkPending();
    const interval = setInterval(checkPending, 2000);
    return () => clearInterval(interval);
  }, [me.is_host, room.id]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // For dead players, Villager/Jester, or someone who already acted
  if (!me.is_alive || role === 'Köylü' || role === 'Soytarı' || hasActed || (role === 'Silahşör' && hasShot)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-1000">
        <h2 className="text-3xl font-serif text-white mb-4">Kasaba Uyuyor</h2>
        <p className="text-gray-400">Sabah olmasını ve diğer oyuncuların eylemlerini tamamlamasını bekleyin...</p>
        
        {investigateResult && (
          <div className="mt-8 p-6 glass-panel border-secondary shadow-[0_0_30px_rgba(212,175,55,0.2)] rounded-xl animate-in zoom-in">
            <p className="text-sm text-gray-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-2">Sorgu Sonucu</p>
            <p className={`text-2xl font-serif mt-4 ${investigateResult === 'Vampir' ? 'text-primary' : 'text-green-400'}`}>
              {investigateResult}
            </p>
          </div>
        )}

        {/* Night Timer Top Center */}
        {timeLeft !== null && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-panel px-6 py-2 rounded-full border-primary shadow-[0_0_15px_rgba(139,0,0,0.5)] flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-xl font-serif text-white tracking-widest">{formatTime(timeLeft)}</span>
          </div>
        )}

        {me.is_host && (
          <div className="mt-8 flex flex-col items-center gap-2">
            {pendingActions && (
              <p className="text-yellow-500 text-sm animate-pulse flex items-center gap-1 font-medium bg-black/50 px-3 py-1 rounded-full">
                ⚠️ Henüz aksiyon almayan kritik roller (Vampir/Doktor) var!
              </p>
            )}
            <button
              onClick={() => { setIsEnding(true); handleEndNightAuto(); }}
              disabled={isEnding}
              className="px-6 py-2 rounded-lg bg-red-900/50 border border-red-500/50 text-red-200 text-sm hover:bg-red-900 transition-all"
            >
              Moderatör: Geceyi Erken Bitir
            </button>
          </div>
        )}
      </div>
    );
  }

  // Filter valid targets based on role
  let validTargets = alivePlayers;
  if (role === 'Vampir') {
    // Vampires can't target themselves or their known teammates
    const teammateIds = teammates.map(t => t.id);
    validTargets = alivePlayers.filter(p => p.id !== me.id && !teammateIds.includes(p.id));
  } else if (role === 'Avcı' || role === 'Silahşör') {
    // Can't target self
    validTargets = alivePlayers.filter(p => p.id !== me.id);
  } else if (role === 'Doktor') {
    // Can target self and anyone else
    validTargets = alivePlayers;
  }

  const handleSelectTarget = (targetId: string) => {
    setSelectedTarget(targetId);
    if (role === 'Vampir' && channel) {
      channel.send({
        type: 'broadcast',
        event: 'vampire_hover',
        payload: { vampireId: me.id, targetId }
      });
      setVampireSelections(prev => ({ ...prev, [me.id]: targetId }));
    }
  };

  const handleAction = async (targetId: string | null) => {
    setIsSubmitting(true);
    try {
      if (role === 'Vampir' && targetId) {
        const aliveVampires = teammates.filter(t => t.is_alive);
        const hasDisagreement = aliveVampires.some(v => vampireSelections[v.id] && vampireSelections[v.id] !== targetId);
        
        if (hasDisagreement) {
          alert("Diğer vampir(ler) ile aynı kişiyi seçmelisiniz! Anlaşmazlık varken oyu onaylayamazsınız.");
          setIsSubmitting(false);
          return;
        }
      }

      if (role === 'Silahşör' && targetId === null) {
        // Pas geçti
        setHasActed(true);
        setIsSubmitting(false);
        return;
      }

      if (!targetId) return;

      if (role === 'Avcı') {
        // Avcı uses the secure RPC
        const { data, error } = await supabase.rpc('investigate_player', {
          p_player_id: me.id,
          p_target_id: targetId
        });
        if (error) throw error;
        setInvestigateResult(data);
        setHasActed(true);
      } else {
        // Diğer roller night_actions tablosuna yazar
        let actionType = '';
        if (role === 'Vampir') actionType = 'kill';
        else if (role === 'Doktor') actionType = 'heal';
        else if (role === 'Silahşör') {
          actionType = 'shoot';
          localStorage.setItem('has_shot', 'true');
          setHasShot(true);
        }

        const { error } = await supabase.from('night_actions').insert({
          room_id: room.id,
          player_id: me.id,
          target_id: targetId,
          action_type: actionType
        });
        if (error) throw error;
        setHasActed(true);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Aksiyon kaydedilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleInstructions = () => {
    switch (role) {
      case 'Vampir': return 'Kimi öldürmek istersin? (Tüm vampirler aynı kişide uzlaşmalıdır)';
      case 'Doktor': return 'Kimi korumak istersin? (Kendini de koruyabilirsin)';
      case 'Avcı': return 'Kimin rolünü öğrenmek istersin? (Vampir mi, değil mi?)';
      case 'Silahşör': return 'Kimi vurmak istersin? (Yanlış kişiyi vurursan sen de ölürsün!)';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col max-w-6xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-2">
        <div className="text-center md:text-left">
          <h2 className="text-xl md:text-2xl font-serif text-white mb-0.5">{role} Aksiyonu</h2>
          <p className="text-gray-400 text-xs md:text-sm">{getRoleInstructions()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
        {validTargets.map(player => {
          const avatar = AVATARS.find(a => a.id === player.avatar_id);
          const isSelected = selectedTarget === player.id;
          
          return (
            <button
              key={player.id}
              onClick={() => handleSelectTarget(player.id)}
              className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                isSelected 
                  ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(139,0,0,0.3)]' 
                  : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 w-full relative">
                <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-white/20 shrink-0">
                  {avatar ? <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" /> : null}
                </div>
                <span className="font-medium text-white truncate text-sm">{player.nickname}</span>
                
                {/* Minik avatar(lar) (Vampirler için kim kime bakıyor) */}
                {role === 'Vampir' && (
                  <div className="absolute -bottom-2 -right-1 flex gap-0.5">
                    {teammates.filter(t => t.is_alive).map(t => {
                      if (vampireSelections[t.id] === player.id) {
                        const teammateAvatar = AVATARS.find(a => a.id === t.avatar_id);
                        return teammateAvatar ? (
                          <div key={t.id} className="w-4 h-4 rounded-full border border-red-500 overflow-hidden bg-black shadow-[0_0_5px_rgba(255,0,0,0.5)] z-10" title={t.nickname}>
                            <img src={teammateAvatar.src} className="w-full h-full object-cover" />
                          </div>
                        ) : null;
                      }
                      return null;
                    })}
                    {vampireSelections[me.id] === player.id && (
                      <div className="w-4 h-4 rounded-full border border-red-500 overflow-hidden bg-red-600 shadow-[0_0_5px_rgba(255,0,0,0.5)] z-10 flex items-center justify-center text-[10px] text-white" title="Sen">
                        {(() => {
                          const myAvatar = AVATARS.find(a => a.id === me.avatar_id);
                          return myAvatar ? (
                            <img src={myAvatar.src} className="w-full h-full object-cover" />
                          ) : (
                            me.nickname.charAt(0).toUpperCase()
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 justify-center">
        {role === 'Silahşör' && (
          <button
            onClick={() => handleAction(null)}
            disabled={isSubmitting}
            className="flex-1 max-w-[200px] py-2.5 rounded-lg text-sm font-medium border bg-black/40 border-white/10 text-gray-400 hover:bg-white/10 transition-all"
          >
            Aksiyon Alma
          </button>
        )}
        <button
          onClick={() => handleAction(selectedTarget)}
          disabled={!selectedTarget || isSubmitting}
          className="flex-1 max-w-[200px] py-2.5 rounded-lg text-sm font-medium bg-primary text-white border border-primary/50 hover:bg-primary-dark disabled:opacity-50 transition-all"
        >
          {isSubmitting ? '...' : 'Onayla'}
        </button>
      </div>

      {me.is_host && (
        <div className="mt-4 flex flex-col md:flex-row items-center justify-center gap-2 w-full">
          {pendingActions && (
            <p className="text-yellow-500 text-xs animate-pulse flex items-center gap-1 font-medium bg-black/50 px-2 py-1 rounded-lg">
              ⚠️ Vampir/Doktor bekleniyor
            </p>
          )}
          <button
            onClick={() => { setIsEnding(true); handleEndNightAuto(); }}
            disabled={isEnding}
            className="px-3 py-1.5 rounded-lg bg-red-900/50 border border-red-500/50 text-red-200 text-xs hover:bg-red-900 transition-all font-medium shrink-0"
          >
            Geceyi Erken Bitir
          </button>
        </div>
      )}

    </div>
  );
};
