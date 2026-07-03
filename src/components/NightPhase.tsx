import React, { useState } from 'react';
import { Player } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

interface NightPhaseProps {
  room: any;
  me: Player;
  role: string;
  teammates: any[];
  alivePlayers: Player[];
}

export const NightPhase: React.FC<NightPhaseProps> = ({ room, me, role, teammates, alivePlayers }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasActed, setHasActed] = useState(false);
  const [investigateResult, setInvestigateResult] = useState<string | null>(null);
  const [hasShot, setHasShot] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('has_shot') === 'true';
    }
    return false;
  });

  // For Villager/Jester or someone who already acted
  if (role === 'Köylü' || role === 'Soytarı' || hasActed || (role === 'Silahşör' && hasShot)) {
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

  const handleAction = async (targetId: string | null) => {
    setIsSubmitting(true);
    try {
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
      case 'Vampir': return 'Kimi öldürmek istersin? (İlk seçimi yapanın kararı geçerli sayılır)';
      case 'Doktor': return 'Kimi korumak istersin? (Kendini de koruyabilirsin)';
      case 'Avcı': return 'Kimin rolünü öğrenmek istersin? (Vampir mi, değil mi?)';
      case 'Silahşör': return 'Kimi vurmak istersin? (Yanlış kişiyi vurursan sen de ölürsün!)';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-serif text-white mb-2">{role} Aksiyonu</h2>
        <p className="text-gray-400">{getRoleInstructions()}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {validTargets.map(player => (
          <button
            key={player.id}
            onClick={() => setSelectedTarget(player.id)}
            className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
              selectedTarget === player.id
                ? role === 'Vampir' || role === 'Silahşör' 
                  ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(139,0,0,0.3)]' 
                  : 'bg-green-900/40 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <span className="text-white font-medium">{player.nickname} {player.id === me.id && "(Sen)"}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 items-center">
        <button
          onClick={() => handleAction(selectedTarget)}
          disabled={!selectedTarget || isSubmitting}
          className="w-full max-w-md py-4 rounded-lg font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 disabled:opacity-50 transition-all"
        >
          {isSubmitting ? 'İşleniyor...' : 'Onayla'}
        </button>
        
        {role === 'Silahşör' && (
          <button
            onClick={() => handleAction(null)}
            disabled={isSubmitting}
            className="text-sm text-gray-500 hover:text-white transition-colors underline mt-2"
          >
            Bu gece pas geç (Ateş etme)
          </button>
        )}
      </div>
    </div>
  );
};
