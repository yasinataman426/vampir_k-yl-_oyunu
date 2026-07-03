"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase, Player, Room } from "@/lib/supabase";
import { RoleRevealCard, Teammate } from "@/components/RoleRevealCard";
import { NightPhase } from "@/components/NightPhase";
import { DayPhase } from "@/components/DayPhase";
import { VotingPhase } from "@/components/VotingPhase";
import { EndGame } from "@/components/EndGame";
import { Button } from "@/components/ui/Button";

type GameState = 'loading' | 'starting' | 'revealing' | 'playing';

export default function GamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const roomCode = resolvedParams.roomCode.toUpperCase();
  
  const [gameState, setGameState] = useState<GameState>('loading');
  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<Player | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  useEffect(() => {
    let roomSub: any;

    const initGame = async () => {
      try {
        // 1. Fetch Room
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .single();

        if (roomError || !roomData) throw new Error('Oda bulunamadı.');
        setRoom(roomData);

        // 2. Identify Player
        const localPlayerId = localStorage.getItem('vampir_player_id');
        if (!localPlayerId) {
          router.push('/');
          return;
        }

        // 3. Fetch SECURE game state via RPC
        const { data: playersState, error: stateError } = await supabase
          .rpc('get_game_state', { p_player_id: localPlayerId });

        if (stateError || !playersState) throw new Error('Oyun durumu alınamadı.');
        
        setAllPlayers(playersState);

        // 4. Extract "Me" and "Teammates"
        const myData = playersState.find((p: any) => p.id === localPlayerId);
        if (!myData) throw new Error('Oyuncu bulunamadı.');
        setMe(myData);

        const myTeammates = playersState.filter((p: any) => 
          p.id !== localPlayerId && p.role !== null
        );
        setTeammates(myTeammates);

        // Subscribe to Room Phase Changes (Day/Night transitions)
        roomSub = supabase
          .channel(`game_room_${roomData.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomData.id}` },
            (payload) => {
              if (payload.new.phase !== roomData.phase) {
                 // The phase changed. Let's just reload the whole page to get fresh state.
                 window.location.reload();
              }
            }
          )
          .subscribe();

        // Check if we need to show reveal or skip straight to playing (if it's not the very first night)
        // For simplicity, if we just loaded, we show reveal, but realistically we only show reveal on cycle 1.
        // I will assume for now we always show reveal on load if it's phase = 'day' initially, 
        // but since room is activated, phase defaults to 'day'. Wait, our RPC didn't change phase to night on start.
        // Actually, if phase is already night, skip reveal and go to playing.
        if (roomData.phase === 'night') {
          setGameState('playing');
        } else {
          // It's technically day right after start, wait...
          // If we want Night 1 to happen first, we should let the host change phase to night.
          // For now, let's just do reveal -> playing.
          setGameState('starting');
          setTimeout(() => {
            setGameState('revealing');
          }, 3000);
        }

      } catch (err) {
        console.error(err);
        router.push('/');
      }
    };

    initGame();

    return () => {
      if (roomSub) supabase.removeChannel(roomSub);
    }
  }, [roomCode, router]);

  const handleEndNight = async () => {
    if (!room) return;
    try {
      const { error } = await supabase.rpc('process_night', { p_room_id: room.id });
      if (error) throw error;
      // Realtime listener will catch the update and reload the page
    } catch (err: any) {
      console.error(err);
      alert("Gece sonlandırılırken hata oluştu: " + err.message);
    }
  };

  const handleStartNight = async () => {
    if (!room) return;
    try {
      const { error } = await supabase.from('rooms').update({ phase: 'night' }).eq('id', room.id);
      if (error) throw error;
      // Realtime listener will catch the update and reload the page
    } catch (err: any) {
      console.error(err);
      alert("Gece başlatılırken hata oluştu: " + err.message);
    }
  };

  if (gameState === 'loading') {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-white text-xl font-serif">Oyun Yükleniyor...</div>
      </main>
    );
  }

  // Pure black overlay with cinematic text for the transition
  if (gameState === 'starting') {
    return (
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-black/80">
        <div className="z-10 text-center animate-in fade-in zoom-in duration-1000 fill-mode-forwards">
          <h1 className="text-5xl md:text-7xl font-serif text-white tracking-widest mb-4 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            {room?.phase === 'night' ? 'GECE ÇÖKTÜ' : 'GÜNEŞ BATIYOR'}
          </h1>
          <p className="text-xl text-secondary tracking-widest animate-pulse">Kasaba uykuya dalıyor...</p>
        </div>
      </main>
    );
  }

  const alivePlayers = allPlayers.filter(p => p.is_alive);

  return (
    <main className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center mb-10 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-serif text-white tracking-wide flex items-center gap-3">
            {room?.phase === 'night' ? (
              <><span className="w-3 h-3 rounded-full bg-primary animate-pulse"></span> Gece Fazı</>
            ) : (
              <><span className="w-3 h-3 rounded-full bg-yellow-400"></span> Gündüz Fazı</>
            )}
          </h1>
          <p className="text-gray-400 mt-1">Oda: {roomCode}</p>
        </div>
        
        <div className="glass-panel px-4 py-2 rounded-lg text-center border-white/10">
          <span className="text-xs text-secondary uppercase tracking-widest font-semibold block mb-1">Sen</span>
          <span className="text-white font-medium">{me?.nickname}</span>
          {!me?.is_alive && <span className="block text-red-500 text-xs mt-1 font-bold">(ÖLÜ)</span>}
        </div>
      </header>

      {gameState === 'revealing' && me?.role && (
        <RoleRevealCard 
          role={me.role} 
          teammates={teammates}
          onContinue={() => setGameState('playing')} 
        />
      )}

      {gameState === 'playing' && (
        <div className="flex-1 flex flex-col animate-in fade-in duration-1000">
          
          {room?.phase === 'endgame' ? (
            <EndGame room={room} me={me} />
          ) : !me?.is_alive ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="glass-panel border-primary/50 p-8 rounded-xl text-center max-w-lg w-full">
                <h2 className="text-3xl font-serif text-primary mb-4">Öldün</h2>
                <p className="text-gray-400">Artık oyuna müdahale edemezsin. Geri kalanları izle.</p>
              </div>
            </div>
          ) : room?.phase === 'night' ? (
            <NightPhase 
              room={room} 
              me={me} 
              role={me.role || 'Köylü'} 
              teammates={teammates} 
              alivePlayers={alivePlayers} 
            />
          ) : room?.phase === 'day' ? (
            <DayPhase room={room} me={me} alivePlayers={alivePlayers} />
          ) : room?.phase === 'voting' ? (
            <VotingPhase room={room} me={me} alivePlayers={alivePlayers} />
          ) : null}

          {/* Host Controls */}
          {me?.is_host && room?.phase === 'night' && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
               <Button variant="primary" className="shadow-[0_0_30px_rgba(133,20,75,0.4)] px-8" onClick={handleEndNight}>
                 Moderatör: Geceyi Bitir
               </Button>
            </div>
          )}

          {me?.is_host && room?.phase === 'voting' && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
               <Button variant="primary" className="shadow-[0_0_30px_rgba(133,20,75,0.4)] px-8" onClick={async () => {
                 try {
                   await supabase.rpc('process_voting', { p_room_id: room.id });
                 } catch(e: any) {
                   console.error(e);
                   alert("Oylama hesaplanırken hata: " + e.message);
                 }
               }}>
                 Moderatör: Oyları Say ve Bitir
               </Button>
            </div>
          )}

        </div>
      )}
    </main>
  );
}
