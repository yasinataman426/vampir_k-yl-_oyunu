import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface EndGameProps {
  room: any;
  me: any;
}

export const EndGame: React.FC<EndGameProps> = ({ room, me }) => {
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in zoom-in duration-1000 fill-mode-forwards text-center">
      <div className={`glass-panel p-12 rounded-3xl border-t border-l border-white/10 ${info.shadow} max-w-lg w-full`}>
        <h2 className="text-sm uppercase tracking-[0.4em] text-gray-400 mb-4">Oyun Sonucu</h2>
        <h1 className={`text-4xl md:text-5xl font-serif mb-6 ${info.color}`}>{info.title}</h1>
        <p className="text-xl text-gray-300 mb-8">{info.desc}</p>

        {room.last_killed_nicknames && room.last_killed_nicknames.length > 0 && (
          <div className="mb-10 text-sm text-gray-500">
            Son Ölen(ler): {room.last_killed_nicknames.join(', ')}
          </div>
        )}

        <Button variant="secondary" onClick={() => router.push('/')} className="w-full">
          Ana Menüye Dön
        </Button>
      </div>
    </div>
  );
};
