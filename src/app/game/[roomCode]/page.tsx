"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase, Player, Room } from "@/lib/supabase";
import { AVATARS } from "@/lib/constants";
import { RoleRevealCard, Teammate } from "@/components/RoleRevealCard";
import { NightPhase } from "@/components/NightPhase";
import { DayPhase } from "@/components/DayPhase";
import { VotingPhase } from "@/components/VotingPhase";
import { EndGame } from "@/components/EndGame";
import { Button } from "@/components/ui/Button";

type GameState = 'loading' | 'starting' | 'revealing' | 'playing' | 'voting_result' | 'night_result';

export default function GamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const roomCode = resolvedParams.roomCode.toUpperCase();
  
  const [gameState, setGameState] = useState<GameState>('loading');
  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<Player | null>(null);
  const [teammates, setTeammates] = useState<any[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
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
          .channel(`game_room_${roomData.id}_${Date.now()}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomData.id}` },
            (payload) => {
              if (payload.new.is_active === false) {
                 // Game was reset by host, send everyone back to lobby
                 router.push(`/lobby/${roomCode}`);
              } else if (payload.new.phase !== roomData.phase) {
                 if (roomData.phase === 'voting' && payload.new.phase === 'night') {
                   sessionStorage.setItem(`show_voting_result_${roomData.id}`, 'true');
                 } else if (roomData.phase === 'night' && payload.new.phase === 'day') {
                   sessionStorage.setItem(`show_night_result_${roomData.id}`, 'true');
                 }
                 window.location.reload();
              }
            }
          )
          .subscribe();

        const hasSeenReveal = sessionStorage.getItem(`revealed_${roomData.id}`);
        const showNightResult = sessionStorage.getItem(`show_night_result_${roomData.id}`);
        const showVotingResult = sessionStorage.getItem(`show_voting_result_${roomData.id}`);

        if (showNightResult === 'true') {
          sessionStorage.removeItem(`show_night_result_${roomData.id}`);
          setGameState('night_result');
          setTimeout(() => {
            setGameState('starting');
            setTimeout(() => {
              setGameState('playing');
            }, 1000);
          }, 4000);
        } else if (showVotingResult === 'true') {
          sessionStorage.removeItem(`show_voting_result_${roomData.id}`);
          setGameState('voting_result');
          setTimeout(() => {
            setGameState('starting');
            setTimeout(() => {
              setGameState('playing');
            }, 1000);
          }, 3000);
        } else if (hasSeenReveal === 'true') {
          setGameState('playing');
        } else if (roomData.phase === 'night' || roomData.phase === 'voting' || roomData.phase === 'endgame') {
          // If they join mid-game (e.g. refreshed page), skip reveal
          setGameState('playing');
        } else {
          // It's the very first day phase when the game starts
          setGameState('starting');
          setTimeout(() => {
            setGameState('revealing');
          }, 1500);
        }

      } catch (err: any) {
        console.error(err);
        setInitError(err.message || 'Bilinmeyen bir hata oluştu');
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
      <>
        <div className="fixed inset-0 -z-20 bg-[length:100%_100%] bg-no-repeat transition-all duration-1000 ease-in-out" style={{ backgroundImage: `url('/images/lobby_bg.png')` }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"></div>
        </div>
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-white text-xl font-serif">Oyun Yükleniyor...</div>
        </main>
      </>
    );
  }

  if (initError) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="glass-panel border-red-500/50 p-8 rounded-xl text-center max-w-lg w-full">
          <h2 className="text-3xl font-serif text-red-500 mb-4">Hata Oluştu</h2>
          <p className="text-gray-400 mb-6">{initError}</p>
          <Button onClick={() => router.push('/')} variant="secondary">Ana Sayfaya Dön</Button>
        </div>
      </main>
    );
  }

  if (!me || !room) return null;

  if (gameState === 'night_result') {
    const killedNames = room?.last_killed_nicknames || [];
    const killedPlayers = allPlayers.filter(p => killedNames.includes(p.nickname));

    return (
      <>
        <div className="fixed inset-0 -z-20 bg-[length:100%_100%] bg-no-repeat transition-all duration-1000 ease-in-out" style={{ backgroundImage: `url('/images/day_bg.png')` }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"></div>
        </div>
        <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="z-10 text-center animate-in fade-in zoom-in duration-1000 w-full max-w-4xl px-4">
            <h1 className="text-4xl md:text-6xl font-serif text-white tracking-widest mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              GECENİN ÖZETİ
            </h1>
          {killedNames.length > 0 ? (
            <div className="glass-panel p-6 md:p-8 rounded-2xl border-red-900/50 shadow-[0_0_50px_rgba(139,0,0,0.5)] flex flex-col items-center">
              <p className="text-lg md:text-xl text-gray-300 mb-4 md:mb-6 uppercase tracking-widest">Bu Gece Ölenler:</p>
              <div className="flex flex-wrap gap-8 justify-center">
                {killedPlayers.map(p => {
                  const avatar = AVATARS.find(a => a.id === p.avatar_id);
                  return (
                    <div key={p.id} className="flex flex-col items-center animate-in zoom-in duration-700">
                      {avatar && (
                        <div className="w-24 h-24 mb-4 rounded-full border-2 border-primary overflow-hidden shadow-[0_0_15px_rgba(139,0,0,0.6)]">
                          <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <p className="text-3xl font-serif text-primary font-bold">{p.nickname}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-6 md:p-10 rounded-2xl border-green-900/50 shadow-[0_0_50px_rgba(34,197,94,0.3)] flex flex-col items-center">
              <p className="text-lg md:text-xl text-gray-300 mb-2 md:mb-4 uppercase tracking-widest">Sonuç:</p>
              <p className="text-2xl md:text-3xl font-serif text-green-400 font-bold mb-2 md:mb-4">Doktor işini iyi yaptı!</p>
              <p className="text-lg md:text-xl text-white">Bu gece kimse ölmedi.</p>
            </div>
          )}
        </div>
      </main>
      </>
    );
  }

  if (gameState === 'voting_result') {
    const hungName = room?.last_hung_nickname;
    const hungPlayer = allPlayers.find(p => p.nickname === hungName);
    const hungAvatar = hungPlayer ? AVATARS.find(a => a.id === hungPlayer.avatar_id) : null;
    
    return (
      <>
        <div className="fixed inset-0 -z-20 bg-[length:100%_100%] bg-no-repeat transition-all duration-1000 ease-in-out" style={{ backgroundImage: `url('/images/voting_bg.png')` }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"></div>
        </div>
        <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="z-10 text-center animate-in fade-in zoom-in duration-1000">
            <h1 className="text-4xl md:text-6xl font-serif text-white tracking-widest mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              KASABANIN KARARI
            </h1>
          {hungName ? (
            <div className="glass-panel p-6 md:p-10 rounded-2xl border-red-900/50 shadow-[0_0_50px_rgba(139,0,0,0.5)] flex flex-col items-center">
              <p className="text-lg md:text-xl text-gray-300 mb-4 uppercase tracking-widest">Asılan Kişi:</p>
              {hungAvatar && (
                <div className="w-24 h-24 mb-4 rounded-full border-2 border-primary overflow-hidden shadow-[0_0_15px_rgba(139,0,0,0.6)]">
                  <img src={hungAvatar.src} alt={hungAvatar.name} className="w-full h-full object-cover" />
                </div>
              )}
              <p className="text-5xl font-serif text-primary font-bold">{hungName}</p>
            </div>
          ) : (
            <div className="glass-panel p-6 md:p-10 rounded-2xl border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.1)] flex flex-col items-center">
              <p className="text-lg md:text-xl text-gray-300 mb-4 uppercase tracking-widest">Oylama Sonucu:</p>
              <p className="text-2xl md:text-3xl font-serif text-white font-bold">Kimse Asılmadı (Pas Geçildi)</p>
            </div>
          )}
        </div>
      </main>
      </>
    );
  }

  // Cinematic text for the transition
  if (gameState === 'starting') {
    return (
      <>
        <div className="fixed inset-0 -z-20 bg-[length:100%_100%] bg-no-repeat transition-all duration-1000 ease-in-out" style={{ backgroundImage: `url('/images/${room?.phase === 'night' ? 'night_bg.png' : 'day_bg.png'}')` }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"></div>
        </div>
        <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="z-10 text-center animate-in fade-in zoom-in duration-1000 fill-mode-forwards">
            <h1 className="text-5xl md:text-7xl font-serif text-white tracking-widest mb-4 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
              {room?.phase === 'night' ? 'GECE ÇÖKTÜ' : 'GÜNEŞ DOĞUYOR'}
            </h1>
            <p className="text-xl text-secondary tracking-widest animate-pulse">
              {room?.phase === 'night' ? 'Kasaba uykuya dalıyor...' : 'Kasaba uyanıyor...'}
            </p>
          </div>
        </main>
      </>
    );
  }

  const alivePlayers = allPlayers.filter(p => p.is_alive);

  return (
    <>
      {/* Dynamic Background */}
      <div 
        className="fixed inset-0 -z-20 bg-[length:100%_100%] bg-no-repeat transition-all duration-1000 ease-in-out"
        style={{
          backgroundImage: `url('/images/${
            room?.phase === 'night' ? 'night_bg.png' :
            room?.phase === 'day' ? 'day_bg.png' :
            room?.phase === 'voting' ? 'voting_bg.png' :
            'lobby_bg.png'
          }')`
        }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
      </div>

      <main className="flex-1 flex flex-col p-4 md:p-6 pb-24 max-w-5xl mx-auto w-full relative z-10">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 gap-2">
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
          onContinue={() => {
            if(room) sessionStorage.setItem(`revealed_${room.id}`, 'true');
            setGameState('playing');
          }} 
        />
      )}

      {gameState === 'playing' && (
        <div className="flex-1 flex flex-col animate-in fade-in duration-1000">
          
          {room?.phase === 'endgame' ? (
            <EndGame room={room} me={me} allPlayers={allPlayers} />
          ) : room?.phase === 'night' ? (
            <NightPhase 
              room={room} 
              me={me} 
              role={me.role || 'Köylü'} 
              teammates={teammates} 
              alivePlayers={alivePlayers} 
            />
          ) : room?.phase === 'day' ? (
            <DayPhase room={room} me={me} allPlayers={allPlayers} alivePlayers={alivePlayers} />
          ) : room?.phase === 'voting' ? (
            <VotingPhase room={room} me={me} alivePlayers={alivePlayers} />
          ) : null}



        </div>
      )}
      </main>
    </>
  );
}
