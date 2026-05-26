#!/usr/bin/env node
/**
 * Seed: cria N posts no Firestore com TTL de 48h dentro de um raio de 50 km
 * do CEP 09351-522 (Rua Diamante, Jardim Itapark, Mauá-SP).
 *
 *   Centro (geocoded via Nominatim): -23.6822835, -46.4319888
 *   Auth:   admin@pulsar.app  (mesmo usuário de create-default-user.js)
 *   Regras: 1h <= expiresAt - createdAt <= 72h  → 48h é válido
 *
 * Uso:
 *   node scripts/seed-posts.js               # cria 25 posts
 *   node scripts/seed-posts.js --count 30    # quantidade custom
 *   node scripts/seed-posts.js --dry-run     # só imprime, não envia
 */

const API_KEY    = 'AIzaSyD3iZLF6n8SoBty-i9bOYxKHd84-ujVdfY';
const PROJECT_ID = 'pulsar-bab90';
const CREDS      = { email: 'admin@pulsar.app', password: 'Pulsar@2026' };

const CENTER     = { lat: -23.6822835, lng: -46.4319888 };  // CEP 09351-522
const RADIUS_KM  = 50;
const TTL_HOURS  = 48;

const argv      = process.argv.slice(2);
const DRY_RUN   = argv.includes('--dry-run');
const COUNT_IDX = argv.indexOf('--count');
const COUNT     = COUNT_IDX >= 0 ? parseInt(argv[COUNT_IDX + 1], 10) : 25;

if (!Number.isFinite(COUNT) || COUNT < 1) {
  console.error('--count inválido');
  process.exit(1);
}

// ----- Conteúdos hiperlocais realistas (título + corpo, < 280 chars) -----
const POSTS = [
  ['Food truck no Pq. Central',    '🌭 Food truck de hot dog gourmet chegou agora no Parque Central. Fila pequena, sai rápido.'],
  ['Brechó na Pça. da Matriz',     '👗 Brechó solidário rolando até as 22h. Camisetas a R$ 5, jaqueta a R$ 25. Cartão e pix.'],
  ['Cachorro perdido — Sira',      '🐶 Vira-lata caramelo, coleira azul, sumiu na Av. Capitão João. Atende por Sira. Recompensa.'],
  ['Sem luz no Itapark',           '⚡ Energia foi 19h05 no Jd. Itapark e adjacências. Enel notificada, sem previsão.'],
  ['Promo relâmpago — bar do Zé',  '🍺 Chopp a R$ 8 até as 23h. Sem couvert hoje. Sertanejo ao vivo a partir das 21h.'],
  ['Feira noturna SBC',            '🌮 Feira gastronômica no Paço Municipal de SBC até meia-noite. 30+ barracas.'],
  ['Pista interditada',            '🚧 Via Anchieta sentido litoral parada no km 19. Acidente leve, faixa da direita.'],
  ['Gatinhos pra adoção',          '🐱 4 filhotes castrados procuram lar. Vacinados. Larga do Ipiranguinha, Santo André.'],
  ['Show grátis na Lapa',          '🎸 Banda de blues tocando de graça no boteco da esquina. Roda até as 2h.'],
  ['Fila zero — Detran Mauá',      '🪪 Detran de Mauá sem fila agora. Atendimento direto, primeira habilitação.'],
  ['Bazar da igreja',              '⛪ Bazar beneficente da Paróquia São Paulo Apóstolo até as 20h. Roupa, livro, bolo.'],
  ['Truck de hambúrguer ABC',      '🍔 Smash burger artesanal no Pq. Central de Diadema. Combo a R$ 25 até as 23h.'],
  ['Trânsito Av. Industrial',      '🚗 Industrial parada do trevo até o shopping. Obra de recapeamento, evitar.'],
  ['Sarau na praça',               '🎤 Sarau de poesia na Pça. da República, microfone aberto, 19h às 22h. Entrada franca.'],
  ['Feijoada do Tonhão',           '🍲 Feijoada à vontade hoje, R$ 35 com refri. Travessa da Liberdade, até acabar.'],
  ['Pets desaparecidos — gato',    '🐈 Gato cinza fugiu da Vila Vitória, atende por Felipe. Tem chip. Avisem por favor.'],
  ['Open mic standup',             '😂 Open mic de standup no bar do Centro de SCS, R$ 10. Começa 20h30, 10 comediantes.'],
  ['Promo brechó vintage',         '🧥 50% off em todas as jaquetas até as 21h. Brechó Retrô no Pq. das Nações.'],
  ['Truck japonês — Diadema',      '🍣 Sushi truck no Pq. do Paço. Combo 20 peças R$ 39. Aceita pix e cartão.'],
  ['Som alto vizinho',             '🔊 Festa rolando no condomínio Vila Magini desde as 18h. Já chamaram a PM.'],
  ['Show de rock SP centro',       '🎸 Rock cover dos anos 80 na Galeria do Rock, palco interno. Entrada R$ 20.'],
  ['Quermesse Mauá',               '🎡 Quermesse na Paróquia Sant’Ana até as 23h. Quentão, pastel e pescaria.'],
  ['Doação de roupas',             '🧣 ONG recebendo doação de roupas de inverno até as 21h. Rua das Acácias, 432.'],
  ['Tatuagem flash day',           '🖋️ Flash day de tatuagem na Vila Assunção, peças a partir de R$ 80. Até as 23h.'],
  ['Cachorro encontrado',          '🐕 Encontramos um vira-lata preto e branco no Jd. Zaíra. Coleira vermelha. Aviso aí.'],
  ['Treino aberto corrida',        '🏃 Treino aberto de corrida no Parque da Juventude, 6h. Todos os pace, sem custo.'],
  ['Cinema ao ar livre',           '🎬 Cinema na praça do Itapark hoje 20h. Filme: "Cidade de Deus". Pipoca de graça.'],
  ['Aulão de yoga grátis',         '🧘 Aulão de yoga no gramado do Pq. Central, 7h. Levar canga. Todos os níveis.'],
];

// ===== Auth REST =====
async function signIn() {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...CREDS, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Auth falhou: ${data.error?.message || res.status}`);
  return { uid: data.localId, idToken: data.idToken, email: data.email };
}

// ===== Distribuição uniforme dentro do círculo (raio km) =====
function randomPointInRadius(centerLat, centerLng, radiusKm) {
  // r = R * sqrt(u), θ = 2π * v  → distribuição uniforme em área
  const r     = radiusKm * Math.sqrt(Math.random());
  const theta = 2 * Math.PI * Math.random();
  const dLat  = (r * Math.sin(theta)) / 111;
  const dLng  = (r * Math.cos(theta)) / (111 * Math.cos((centerLat * Math.PI) / 180));
  return { lat: centerLat + dLat, lng: centerLng + dLng };
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat  = toRad(b.lat - a.lat);
  const dLng  = toRad(b.lng - a.lng);
  const lat1  = toRad(a.lat);
  const lat2  = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// ===== Firestore REST payload builder =====
function toFirestoreFields(post) {
  return {
    fields: {
      title:         { stringValue:   post.title },
      content:       { stringValue:   post.content },
      latitude:      { doubleValue:   post.lat },
      longitude:     { doubleValue:   post.lng },
      geopoint:      { geoPointValue: { latitude: post.lat, longitude: post.lng } },
      userId:        { stringValue:   post.userId },
      userName:      { stringValue:   post.userName },
      userPhotoURL:  { stringValue:   '' },
      imageUrl:      { stringValue:   '' },
      videoUrl:      { stringValue:   '' },
      createdAt:     { timestampValue: post.createdAt },
      startsAt:      { timestampValue: post.startsAt },
      expiresAt:     { timestampValue: post.expiresAt },
      likedBy:       { arrayValue:    { values: [] } },
      likesCount:    { integerValue:  '0' },
      commentsCount: { integerValue:  '0' },
    },
  };
}

async function createPost(idToken, payload) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/posts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(toFirestoreFields(payload)),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data.name.split('/').pop();
}

// ===== Main =====
(async () => {
  console.log(`Pulsar seed → ${COUNT} posts, 48h TTL, raio ${RADIUS_KM}km de ${CENTER.lat}, ${CENTER.lng}`);
  console.log(DRY_RUN ? '(dry-run, nada será enviado)\n' : '');

  let session;
  if (!DRY_RUN) {
    session = await signIn();
    console.log(`Autenticado como ${session.email} (uid=${session.uid})\n`);
  } else {
    session = { uid: 'dry-run-uid', idToken: 'fake', email: CREDS.email };
  }

  const now       = Date.now();
  const created   = [];
  const failures  = [];

  for (let i = 0; i < COUNT; i++) {
    const [title, content] = POSTS[i % POSTS.length];
    const pt = randomPointInRadius(CENTER.lat, CENTER.lng, RADIUS_KM);

    // Cria posts com createdAt escalonado (últimos 30 min) para variação visual no mapa.
    const ageMin   = Math.floor(Math.random() * 30);
    const createdAt = new Date(now - ageMin * 60_000);
    const expiresAt = new Date(createdAt.getTime() + TTL_HOURS * 3600_000);

    const payload = {
      title,
      content,
      lat: pt.lat,
      lng: pt.lng,
      userId: session.uid,
      userName: 'Administrador',
      createdAt: createdAt.toISOString(),
      startsAt:  createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const dKm = haversineKm(CENTER, pt).toFixed(2);
    process.stdout.write(`[${String(i + 1).padStart(2, '0')}/${COUNT}] ${dKm.padStart(5)}km  ${title.padEnd(28)} `);

    if (DRY_RUN) {
      console.log('(dry)');
      continue;
    }

    try {
      const id = await createPost(session.idToken, payload);
      created.push(id);
      console.log(`✓ ${id}`);
    } catch (err) {
      failures.push({ i, err: err.message });
      console.log(`✗ ${err.message}`);
    }
  }

  console.log(`\nResultado: ${created.length} criados, ${failures.length} falharam.`);
  if (failures.length) {
    console.log('Falhas:');
    failures.forEach((f) => console.log(`  #${f.i + 1}: ${f.err}`));
    process.exit(1);
  }
})();
