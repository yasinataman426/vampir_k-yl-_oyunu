import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

import { Player, Room } from '@/lib/supabase';
import { AVATARS } from '@/lib/constants';

interface EndGameProps {
  room: Room;
  me: Player;
  allPlayers: Player[];
}

export const EndGame: React.FC<EndGameProps> = ({ room, me, allPlayers }) => {
  const router = useRouter();

  const getWinnerInfo = () => {
    switch(room.winner) {
      case 'Villagers': return { title: 'KÖYLÜLER KAZANDI', desc: 'Bütün vampirler temizlendi.', color: 'text-green-500', shadow: 'shadow-[0_0_50px_rgba(34,197,94,0.3)]' };
      case 'Vampires': return { title: 'VAMPİRLER KAZANDI', desc: 'Kasaba karanlığa teslim oldu.', color: 'text-primary', shadow: 'shadow-[0_0_50px_rgba(139,0,0,0.3)]' };
      case 'Jester': return { title: 'SOYTARI KAZANDI', desc: 'Kasaba oyuna geldi ve Soytarıyı astı.', color: 'text-purple-500', shadow: 'shadow-[0_0_50px_rgba(168,85,247,0.3)]' };
      default: return { title: 'OYUN BİTTİ', desc: '', color: 'text-white', shadow: '' };
    }
  };

  const info = getWinnerInfo();

  const getWinnerPlayers = () => {
    switch (room.winner) {
      case 'Vampires': return allPlayers.filter(p => p.role === 'Vampir');
      case 'Jester': return allPlayers.filter(p => p.role === 'Soytarı');
      case 'Villagers': return allPlayers.filter(p => p.role !== 'Vampir' && p.role !== 'Soytarı');
      default: return [];
    }
  };
  const winnerPlayers = getWinnerPlayers();

  const handleRestart = async () => {
    try {
      const { error } = await supabase.rpc('reset_game', { p_room_id: room.id });
      if (error) throw error;
      // Realtime listener in GamePage will detect is_active = false and push everyone to Lobby
    } catch (err: any) {
      console.error(err);
      alert('Yeniden başlatılırken hata oluştu: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in zoom-in duration-1000 fill-mode-forwards text-center p-4">
      <div className={`glass-panel p-6 md:p-12 rounded-3xl border-t border-l border-white/10 ${info.shadow} max-w-4xl w-full`}>
        <h2 className="text-xs md:text-sm uppercase tracking-[0.4em] text-gray-400 mb-2 md:mb-4">Oyun Sonucu</h2>
        <h1 className={`text-3xl md:text-5xl font-serif mb-4 ${info.color}`}>{info.title}</h1>
        <p className="text-lg md:text-xl text-gray-300 mb-6">{info.desc}</p>

        {winnerPlayers.length > 0 && (
          <div className="mb-8 flex flex-wrap justify-center gap-3">
            {winnerPlayers.map(p => {
              const avatar = AVATARS.find(a => a.id === p.avatar_id);
              return (
                <div key={p.id} className="flex items-center gap-2 bg-black/40 border border-white/20 rounded-full pr-4 p-1 shadow-md hover:bg-black/60 transition-colors">
                  {avatar && (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0">
                      <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-white text-sm font-medium">{p.nickname}</span>
                </div>
              );
            })}
          </div>
        )}

        {room.last_killed_nicknames && room.last_killed_nicknames.length > 0 && (
          <div className="mb-8 text-sm text-gray-500">
            Son Ölen(ler): {room.last_killed_nicknames.join(', ')}
          </div>
        )}

        {/* Roles Reveal */}
        {allPlayers && allPlayers.length > 0 && (
          <div className="mt-6 md:mt-8 mb-8 md:mb-10 w-full text-left">
            <h3 className="text-lg md:text-xl font-serif text-white mb-4 border-b border-white/10 pb-2 text-center md:text-left">Oyuncuların Rolleri</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
              {allPlayers.map(player => {
                const avatar = AVATARS.find(a => a.id === player.avatar_id);
                // Köylüleri daha sönük gösterebiliriz
                const isSpecial = player.role !== 'Köylü';
                return (
                  <div key={player.id} className={`p-3 rounded-xl flex items-center gap-4 border ${isSpecial ? 'bg-black/60 border-white/20' : 'bg-black/30 border-white/5 opacity-70'}`}>
                    <div className="w-12 h-12 rounded-full bg-black overflow-hidden border border-white/10 shrink-0">
                      {avatar ? <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm md:text-base truncate max-w-[100px]">{player.nickname}</p>
                      <p className={`text-xs md:text-sm font-bold ${
                        player.role === 'Vampir' ? 'text-red-500' :
                        player.role === 'Doktor' ? 'text-green-500' :
                        player.role === 'Soytarı' ? 'text-purple-500' :
                        player.role === 'Avcı' ? 'text-blue-500' :
                        player.role === 'Silahşör' ? 'text-orange-500' : 'text-gray-400'
                      }`}>
                        {player.role || 'Bilinmiyor'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
          {me.is_host && (
            <Button variant="primary" onClick={handleRestart} className="w-full sm:w-auto px-8 shadow-[0_0_20px_rgba(133,20,75,0.4)]">
              Aynı Odayla Yeniden Oyna
            </Button>
          )}

          <Button variant="secondary" onClick={() => router.push('/')} className="w-full sm:w-auto px-8">
            Ana Menüye Dön
          </Button>
        </div>
      </div>
    </div>
  );
};
