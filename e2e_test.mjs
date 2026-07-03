import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, val] = line.split('=');
  if (key && val) env[key.trim()] = val.trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function runTests() {
  console.log("🚀 BÖLÜM 1: LOBİ VE ROL DAĞITIMI BAŞLIYOR...");

  // 1. Create Room
  const randomCode = 'T' + Math.floor(Math.random() * 10000);
  const { data: room, error: roomError } = await supabase.from('rooms').insert({
    room_code: randomCode,
    timer_setting: 2,
    is_active: false
  }).select().single();
  if (roomError) throw new Error("Room creation failed: " + roomError.message);
  
  console.log(`✅ Oda Oluşturuldu: ${room.id}`);

  // 2. Insert 11 Players
  const players = [];
  for (let i = 1; i <= 11; i++) {
    const { data: player, error: playerError } = await supabase.from('players').insert({
      room_id: room.id,
      nickname: `Oyuncu ${i}`,
      is_host: i === 1,
      is_alive: true
    }).select().single();
    if (playerError) throw new Error("Player creation failed: " + playerError.message);
    players.push(player);
  }
  console.log(`✅ 11 Oyuncu Odaya Katıldı.`);

  // 3. Assign specific roles (3 Vampir, 1 Doktor, 1 Avcı, 1 Soytarı, 1 Silahşör, 4 Köylü)
  const deck = ["Vampir", "Vampir", "Vampir", "Doktor", "Avcı", "Soytarı", "Silahşör", "Köylü", "Köylü", "Köylü", "Köylü"];
  const assignments = players.map((p, i) => ({ player_id: p.id, role: deck[i] }));
  
  const assignResponse = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/assign_roles_batch`, {
    method: 'POST',
    headers: {
      'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_assignments: assignments, p_room_id: room.id })
  });
  if (!assignResponse.ok) {
    const errText = await assignResponse.text();
    console.error("Assign roles error details:", errText);
    throw new Error("Role assignment failed: " + errText);
  }
  console.log(`✅ Roller Başarıyla Dağıtıldı.`);

  // 4. Test Privacy & Security (Get Game State for each player)
  console.log("🔒 Güvenlik (Veri Sızıntısı) Kontrolü Yapılıyor...");
  const roleMap = {};
  for (const player of players) {
    const { data: state, error: stateError } = await supabase.rpc('get_game_state', { p_player_id: player.id });
    if (stateError) throw new Error("Get Game State failed: " + stateError.message);
    
    const myData = state.find(p => p.id === player.id);
    roleMap[player.id] = myData.role;
    
    // Privacy assertions
    const visibleRoles = state.filter(p => p.role !== null).length;
    if (myData.role === 'Vampir') {
      if (visibleRoles !== 3) throw new Error(`Vampir leak! A Vampire sees ${visibleRoles} roles instead of 3.`);
    } else {
      // Köylü, Doktor vb. sadece kendini görmeli (veya varsa diğer doktorları ama burada 1 doktor var)
      if (visibleRoles !== 1) throw new Error(`${myData.role} role leaked! Sees ${visibleRoles} roles instead of 1.`);
    }
  }
  console.log(`✅ Güvenlik Testi Başarılı: Kimse yetkisiz veri (rol) göremiyor.`);

  // Helpers to get player by role
  const getPlayer = (roleName) => players.find(p => roleMap[p.id] === roleName);
  const vampire1 = getPlayer('Vampir');
  const doctor = getPlayer('Doktor');
  const hunter = getPlayer('Avcı');
  const gunslinger = getPlayer('Silahşör');
  const jester = getPlayer('Soytarı');
  const villager = getPlayer('Köylü');

  console.log("\n🌙 BÖLÜM 2: GECE FAZI FONKSİYONLARI");
  
  // Vampir hedefini belirlesin (Köylü)
  await supabase.from('night_actions').insert({ room_id: room.id, player_id: vampire1.id, target_id: villager.id, action_type: 'kill' });
  console.log(`✅ Vampir, ${villager.nickname} (Köylü) hedefini seçti.`);
  
  // Doktor başkasını korusun (Soytarı)
  await supabase.from('night_actions').insert({ room_id: room.id, player_id: doctor.id, target_id: jester.id, action_type: 'heal' });
  console.log(`✅ Doktor, ${jester.nickname} (Soytarı) hedefini korudu.`);

  // Avcı birini sorgulasın (Jester)
  const { data: invData, error: invError } = await supabase.rpc('investigate_player', { p_player_id: hunter.id, p_target_id: jester.id });
  if (invError) throw new Error("Investigate failed: " + invError.message);
  if (invData !== 'Vampir Değil') throw new Error("Avcı yanlış sonuç aldı!");
  console.log(`✅ Avcı sorgu yaptı, sistem doğru cevap verdi: "${invData}"`);

  // Silahşör birini vursun (Diğer vampir olmasın, doktoru vursun ki ölsünler)
  await supabase.from('night_actions').insert({ room_id: room.id, player_id: gunslinger.id, target_id: doctor.id, action_type: 'shoot' });
  console.log(`✅ Silahşör, ${doctor.nickname} (Doktor) hedefini vurdu.`);

  console.log("\n☀️ BÖLÜM 3: GÜNDÜZ FAZI VE MODERATÖR LOGİĞİ");
  // Geceyi bitir
  await supabase.rpc('process_night', { p_room_id: room.id });
  console.log(`✅ Moderatör: Gece bitirildi ve sonuçlar hesaplandı.`);

  // Ölüm / Kalım kontrolü
  const { data: postNightPlayers } = await supabase.from('players').select('*').eq('room_id', room.id);
  const pVillager = postNightPlayers.find(p => p.id === villager.id);
  const pDoctor = postNightPlayers.find(p => p.id === doctor.id);
  const pGunslinger = postNightPlayers.find(p => p.id === gunslinger.id);
  
  if (pVillager.is_alive) throw new Error("Vampirin hedefi (Köylü) ölmedi!");
  if (pDoctor.is_alive) throw new Error("Silahşör masumu vurdu ama hedef (Doktor) ölmedi!");
  if (pGunslinger.is_alive) throw new Error("Silahşör masumu vurdu ama kendisi ölmedi!");
  
  console.log(`✅ Ölüm logikleri doğru çalıştı (Köylü, Doktor ve Silahşör öldü).`);

  // Moderatör mesajı (Rol İfşası Kontrolü)
  const { data: updatedRoom } = await supabase.from('rooms').select('*').eq('id', room.id).single();
  const killedLog = updatedRoom.last_killed_nicknames.join(', ');
  console.log(`✅ Sabah Mesajı: "Dün gece öldürülenler: ${killedLog}"`);
  if (killedLog.includes('Doktor') || killedLog.includes('Silahşör') || killedLog.includes('Vampir')) {
    throw new Error("KRİTİK HATA: Ölen kişilerin rolü sabah ekranında ifşa ediliyor!");
  }
  console.log(`✅ KRİTİK GİZLİLİK TESTİ BAŞARILI: Ölenlerin rolleri kesinlikle ifşa edilmedi.`);

  console.log("\n⚖️ BÖLÜM 4: KAZANMA KOŞULLARI (ENDGAME)");
  // Jester Oylaması
  const aliveNow = postNightPlayers.filter(p => p.is_alive);
  console.log(`Oylamaya ${aliveNow.length} kişi katılıyor. Herkes Soytarı'ya oy veriyor...`);
  
  const votes = aliveNow.map(p => ({
    room_id: room.id,
    voter_id: p.id,
    target_id: jester.id
  }));
  await supabase.from('votes').insert(votes);
  
  await supabase.rpc('process_voting', { p_room_id: room.id });
  
  const { data: jesterRoom } = await supabase.from('rooms').select('*').eq('id', room.id).single();
  if (jesterRoom.phase !== 'endgame' || jesterRoom.winner !== 'Jester') {
    throw new Error("Soytarı asıldığında oyun bitmedi veya Soytarı kazanmadı!");
  }
  console.log(`✅ Soytarı Testi Başarılı: Soytarı asıldı, oyun bitti ve 'Soytarı Kazandı' ekranı tetiklendi.`);

  // Vampir Baskını Testi
  const randomCode2 = 'V' + Math.floor(Math.random() * 10000);
  const { data: room2 } = await supabase.from('rooms').insert({ room_code: randomCode2, timer_setting: 2, is_active: false }).select().single();
  const vPlayers = [];
  for(let i=0; i<4; i++) {
    const { data: p } = await supabase.from('players').insert({ room_id: room2.id, nickname: `P${i}`, is_alive: true }).select().single();
    vPlayers.push(p);
  }
  const vDeck = ["Vampir", "Vampir", "Köylü", "Köylü"];
  const assignResponse2 = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/assign_roles_batch`, {
    method: 'POST',
    headers: {
      'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_room_id: room2.id, p_assignments: vPlayers.map((p, i) => ({ player_id: p.id, role: vDeck[i] })) })
  });
  if (!assignResponse2.ok) {
    throw new Error("Vampir Raid assignment failed: " + await assignResponse2.text());
  }
  
  // Gece 1 Vampir 1 Köylüyü öldürür. (Kalan: 2 Vampir, 1 Köylü -> Vampirler kazanır)
  await supabase.from('night_actions').insert({ room_id: room2.id, player_id: vPlayers[0].id, target_id: vPlayers[2].id, action_type: 'kill' });
  await supabase.rpc('process_night', { p_room_id: room2.id });
  
  const { data: finalRoom } = await supabase.from('rooms').select('*').eq('id', room2.id).single();
  if (finalRoom.phase !== 'endgame' || finalRoom.winner !== 'Vampires') {
    throw new Error("Vampirlerin sayısı köylülere eşit/fazla olduğunda oyun bitmedi!");
  }
  console.log(`✅ Vampir Baskını Testi Başarılı: Vampirler çoğunluğa ulaşınca 'Vampirler Kazandı' ekranı tetiklendi.`);

  console.log("\n🎉 TÜM UÇTAN UCA (E2E) TESTLER KUSURSUZ ŞEKİLDE TAMAMLANDI!");
}

runTests().catch(console.error);
