"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { supabase, Player, Room } from "@/lib/supabase";
import { RoleSettingsPanel } from "@/components/RoleSettingsPanel";
import { RoleCounts, getDefaultRoles, generateRoleDeck, validateRoles } from "@/lib/gameLogic";

export default function LobbyPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const roomCode = resolvedParams.roomCode.toUpperCase();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [roleCounts, setRoleCounts] = useState<RoleCounts>(getDefaultRoles(0));
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let playersSub: any;
    let roomSub: any;

    const initLobby = async () => {
      try {
        // 1. Fetch Room
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .single();

        if (roomError || !roomData) throw new Error('Oda bulunamadı.');
        setRoom(roomData);

        // If game is already active, redirect immediately
        if (roomData.is_active) {
          router.push(`/game/${roomCode}`);
          return;
        }

        // 2. Fetch Players
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomData.id)
          .order('joined_at', { ascending: true });

        if (playersError) throw playersError;
        setPlayers(playersData || []);

        // 3. Identify current player
        const localPlayerId = localStorage.getItem('vampir_player_id');
        if (localPlayerId) {
          const me = playersData?.find(p => p.id === localPlayerId);
          if (me) setCurrentPlayer(me);
        }

        // 4. Subscribe to Realtime (Players & Room)
        // We use a unique channel name to prevent React StrictMode from reusing an active channel
        const channelName = `lobby_${roomData.id}_${Date.now()}`;
        playersSub = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomData.id}` },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                setPlayers(prev => [...prev, payload.new as Player]);
              } else if (payload.eventType === 'UPDATE') {
                setPlayers(prev => prev.map(p => p.id === payload.new.id ? (payload.new as Player) : p));
              } else if (payload.eventType === 'DELETE') {
                setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomData.id}` },
            (payload) => {
              if (payload.new.is_active) {
                router.push(`/game/${roomCode}`);
              }
            }
          )
          .subscribe();

      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initLobby();

    return () => {
      if (playersSub) supabase.removeChannel(playersSub);
    };
  }, [roomCode, router]);

  const handleStartGame = async () => {
    if (!room || !currentPlayer?.is_host) return;
    if (!validateRoles(players.length, roleCounts)) {
      alert("Atanan özel rol sayısı toplam oyuncu sayısından fazla olamaz!");
      return;
    }

    setIsStarting(true);
    try {
      // 1. Generate shuffled role deck
      const deck = generateRoleDeck(players.length, roleCounts);

      // 2. Prepare assignment payload
      const assignments = players.map((p, index) => ({
        player_id: p.id,
        role: deck[index]
      }));

      // 3. Call secure RPC to assign roles and activate room simultaneously
      const { error: rpcError } = await supabase.rpc('assign_roles_batch', {
        p_room_id: room.id,
        p_assignments: assignments
      });

      if (rpcError) throw rpcError;
      
      // Note: The RPC sets is_active = true, which triggers the Realtime redirect automatically.
    } catch (err) {
      console.error("Error starting game:", err);
      alert("Oyun başlatılırken bir hata oluştu.");
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-white text-xl font-serif">Lobi Yükleniyor...</div>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="text-red-400 text-xl mb-6 font-serif">{error || 'Oda bulunamadı.'}</div>
        <Button onClick={() => router.push('/')} variant="secondary">Ana Sayfaya Dön</Button>
      </main>
    );
  }

  const isHost = currentPlayer?.is_host ?? false;

  return (
    <main className="flex-1 flex flex-col p-4 md:p-6 max-w-5xl mx-auto w-full relative h-[100dvh] overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-center mb-4 pb-4 border-b border-white/10 gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-serif text-white tracking-wide">Oda Lobisi</h1>
          <p className="text-gray-400 mt-1">Oyunun başlaması bekleniyor...</p>
        </div>
        
        <div className="glass-panel px-6 py-3 rounded-lg flex flex-col items-center">
          <span className="text-xs text-secondary uppercase tracking-widest font-semibold mb-1">Oda Kodu</span>
          <span className="text-2xl font-mono text-white tracking-[0.2em]">{roomCode}</span>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Left Col: Players */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-end mb-4 shrink-0">
            <h2 className="text-xl font-medium text-white flex items-center gap-2">
              Katılan Oyuncular 
              <span className="bg-primary/20 text-primary-200 text-sm py-1 px-3 rounded-full border border-primary/30">
                {players.length} / 20
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-2 pb-2 custom-scrollbar">
            {players.map((player) => (
              <div key={player.id} className="glass-panel p-4 rounded-xl flex items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center shadow-inner">
                  <span className="text-lg font-serif text-white">
                    {player.nickname.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {player.nickname} {player.id === currentPlayer?.id && "(Sen)"}
                  </p>
                  <p className={`text-xs ${player.is_host ? 'text-secondary' : 'text-green-400'}`}>
                    {player.is_host ? 'Kurucu' : 'Hazır'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Host Settings */}
        {isHost && (
          <div className="lg:w-96 shrink-0 flex flex-col gap-4 overflow-y-auto pb-2 custom-scrollbar">
            <RoleSettingsPanel 
              playerCount={players.length} 
              roleCounts={roleCounts} 
              onChange={setRoleCounts} 
            />
          </div>
        )}

      </div>

      {/* Footer Actions */}
      <footer className="mt-4 pt-4 border-t border-white/10 flex justify-center shrink-0">
        {isHost ? (
          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="primary" 
              className="px-12 py-4 text-lg" 
              onClick={handleStartGame}
              disabled={players.length < 5 || isStarting}
            >
              {isStarting ? 'Başlatılıyor...' : 'Oyunu Başlat'}
            </Button>
            {players.length < 5 && (
              <p className="text-gray-400 text-sm">Oyunu başlatmak için en az 5 kişi gereklidir.</p>
            )}
          </div>
        ) : (
          <div className="glass-panel px-8 py-4 rounded-full flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-secondary animate-ping"></div>
            <p className="text-gray-300 font-medium">Kurucunun oyunu başlatması bekleniyor...</p>
          </div>
        )}
      </footer>
    </main>
  );
}
