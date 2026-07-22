import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, val] = line.split('=');
  if (key && val) env[key.trim()] = val.trim();
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const roomCode = process.argv[2];
if (!roomCode) {
    console.error("Lütfen oda kodunu girin: node bot_runner.mjs <ODA_KODU>");
    process.exit(1);
}

const AVATARS = [
    'adrian', 'astrid', 'aurora', 'cedric', 'conrad', 'damian', 'darius', 'edgar', 'gabriel', 'gregor',
    'kuzgun', 'mireya', 'morgana', 'morwen', 'raphael', 'rowan', 'silas', 'tobias', 'tristan', 'valen'
];

async function runBots() {
    // 1. Oda bilgisini al
    const { data: room, error: roomError } = await supabase.from('rooms').select('*').eq('room_code', roomCode).single();
    if (roomError || !room) {
        console.error("Oda bulunamadı!");
        return;
    }

    console.log(`✅ Oda bulundu: ${room.id} (${roomCode})`);

    // 2. 9 Bot Oluştur ve Odaya Katıl
    const botIds = [];
    for(let i = 1; i <= 9; i++) {
        const { data: player, error: playerError } = await supabase.from('players').insert({
            room_id: room.id,
            nickname: `Bot ${i}`,
            is_host: false,
            avatar_id: AVATARS[i]
        }).select().single();
        if(player) botIds.push(player.id);
    }
    console.log(`🤖 9 adet bot odaya başarıyla katıldı ve avatarlarını seçti!`);
    console.log(`👉 Lütfen TARAYICINIZDAN OYUNU BAŞLATIN.`);

    // 3. Odadaki olayları dinle (Gerçek zamanlı)
    supabase.channel('bot-room-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, async (payload) => {
          const newPhase = payload.new.phase;
          console.log(`🔄 Yeni Faz: ${newPhase}`);
          
          if(newPhase === 'night') {
              console.log("🌙 Gece oldu. Botlar 5 saniye içinde aksiyonlarını girecek...");
              setTimeout(async () => {
                 const { data: allPlayers } = await supabase.from('players').select('*').eq('room_id', room.id).eq('is_alive', true);
                 
                 for(const botId of botIds) {
                     const me = allPlayers.find(p => p.id === botId);
                     if(!me || !me.is_alive || me.role === 'Köylü' || me.role === 'Soytarı') continue;
                     
                     let target = null;
                     if(me.role === 'Vampir') {
                         const validTargets = allPlayers.filter(p => p.id !== me.id && p.role !== 'Vampir');
                         if(validTargets.length > 0) target = validTargets[Math.floor(Math.random() * validTargets.length)].id;
                     } else {
                         const validTargets = allPlayers.filter(p => p.id !== me.id);
                         if(validTargets.length > 0) target = validTargets[Math.floor(Math.random() * validTargets.length)].id;
                     }

                     if(target) {
                         const actionMap = {'Vampir': 'kill', 'Doktor': 'heal', 'Avcı': 'investigate', 'Silahşör': 'shoot'};
                         await supabase.from('night_actions').insert({
                             room_id: room.id,
                             player_id: me.id,
                             action_type: actionMap[me.role],
                             target_id: target
                         });
                         console.log(`🧛 Bot (${me.role}) aksiyon aldı.`);
                     }
                 }
              }, 5000);
          } else if(newPhase === 'day') {
              console.log("☀️ Gündüz oylaması başladı! Botlar 10 saniye içinde oylarını verecek...");
              setTimeout(async () => {
                 const { data: allPlayers } = await supabase.from('players').select('*').eq('room_id', room.id).eq('is_alive', true);
                 for(const botId of botIds) {
                     const me = allPlayers.find(p => p.id === botId);
                     if(!me || !me.is_alive) continue;

                     const validTargets = allPlayers.filter(p => p.id !== me.id);
                     if(validTargets.length > 0) {
                         const target = validTargets[Math.floor(Math.random() * validTargets.length)].id;
                         await supabase.from('votes').insert({
                             room_id: room.id,
                             voter_id: me.id,
                             target_id: target
                         });
                         console.log(`🗳️ Bot (${me.nickname}) oy verdi.`);
                     }
                 }
              }, 10000); // 10 saniye sonra
          }
      })
      .subscribe((status) => {
          if(status === 'SUBSCRIBED') console.log('📡 Botlar odayı dinliyor...');
      });
}

runBots();
