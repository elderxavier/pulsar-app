# Pulsar — O Radar do Agora

Microblogging **hiperlocal** e **efêmero**. Usuários publicam "pulsos" geolocalizados que aparecem num mapa interativo e expiram automaticamente (TTL configurável, padrão 6h, faixa 1–72h). A ideia é criar conversas contextuais ligadas ao espaço físico e ao momento presente.

> Documento de visão do produto: [PULSAR.md](PULSAR.md). Este README é a referência **técnica** do estado atual do código.

---

## Arquitetura — Monorepo de 4 módulos + Firebase

```
pulsar-app/
├── mobile/        # App Android nativo (Kotlin + Jetpack Compose)      → AAB / Play Store
├── pulsar-web/    # App/PWA do usuário final (Angular 21 + Leaflet)     → :4201
├── pulsar-site/   # Site institucional (Angular 21)                     → :4200 / Docker (pulsar.appsx.com.br)
├── admin/         # Painel administrativo (Angular 21 + leaflet.heat)   → :4301
├── firebase/      # firestore.rules, storage.rules, indexes, firebase.json
└── scripts/       # Seed, criação de usuário, deploy, limpeza de dados
```

| Módulo | Nome do pacote | Stack | Responsabilidade |
|---|---|---|---|
| [mobile/](mobile/) | `com.pulsar.app` | Kotlin 2.0.21, Compose BOM 2024.11, Firebase (Auth/Firestore/**Storage**), OSMDroid, Coil | Cliente principal: criar/ver pulsos no mapa, mídia, likes, comentários |
| [pulsar-web/](pulsar-web/) | `web-v2` | Angular 21, Firebase JS 12, Leaflet | App web do usuário: mapa, dashboard, criação de posts |
| [pulsar-site/](pulsar-site/) | `pulsar-site` | Angular 21 | Landing page institucional (sem Firebase) |
| [admin/](admin/) | `pulsar-admin` | Angular 21, Firebase JS 12, leaflet.heat | Moderação, usuários, métricas, config global, audit log |

**Backend:** Firebase — Authentication, Firestore, Storage, Hosting. Projeto: `pulsar-bab90`.

---

## Modelo de Dados (Firestore)

### `/posts/{postId}` — pulsos efêmeros

```typescript
interface Post {
  id: string;
  title: string;
  content: string;               // 1–280 chars (validado nas rules)
  latitude: number;
  longitude: number;
  geopoint: GeoPoint;            // para geo-queries futuras (GeoFire)
  userId: string;
  userName: string;
  userPhotoURL: string;
  createdAt: Timestamp;
  startsAt: Timestamp;          // agendamento (post pode começar no futuro)
  expiresAt: Timestamp;         // createdAt + [1h..72h]; TTL nativo + rules
  imageUrl: string;             // https:// (Firebase Storage)
  videoUrl: string;             // https:// (Firebase Storage)
  likedBy: string[];            // UIDs
  likesCount: number;           // denormalizado
  commentsCount: number;        // denormalizado
}

// Subcoleção /posts/{postId}/comments/{commentId}
interface Comment {
  id: string; userId: string; userName: string;
  userPhotoURL: string; content: string; createdAt: Timestamp;
}
```

### Outras coleções

| Coleção | Uso | Escrita |
|---|---|---|
| `/users/{uid}` | Perfil (`displayName`, `photoURL`, `banned`, `adminRequested`) | Dono (exceto flags privilegiadas); admin gerencia flags |
| `/admins/{uid}` | Bootstrap de admin: `{ admin, superAdmin? }` | Apenas superAdmin (bootstrap inicial via Console) |
| `/reports/{id}` | Denúncias de posts (`status: 'open'`) | Qualquer usuário cria; admin resolve |
| `/config/global` | Config runtime (TTL, raio, kill-switch, banner) | Apenas superAdmin |
| `/audit/{id}` | Log append-only de ações admin | Admin cria; update/delete bloqueados |

---

## Segurança

Fonte da verdade: [firebase/firestore.rules](firebase/firestore.rules) e [firebase/storage.rules](firebase/storage.rules).

**Admin híbrido:** `isAdmin()` = custom claim `token.admin == true` **OU** doc `/admins/{uid}.admin == true`. Idem `superAdmin`. O modelo por doc permite bootstrap sem Cloud Functions.

**Regras de `posts`:**
- **Leitura:** qualquer usuário autenticado.
- **Criação:** autenticado, `userId == auth.uid`, `content` 1–280 chars, e `1h ≤ expiresAt − createdAt ≤ 72h` (TTL não pode ser forjado).
- **Update:** admin, ou o dono — mas `createdAt`, `expiresAt`, `latitude`, `longitude` são **imutáveis** (só título/conteúdo/mídia editam).
- **Delete:** admin ou dono.

**TTL:** duplamente garantido — política **TTL nativa do Firestore** no campo `expiresAt` ([indexes.json](firebase/firestore.indexes.json) `fieldOverrides.ttl`) + validação de janela nas rules.

**Storage** (`/posts/{userId}/{file}` e `/users/{userId}/{file}`): leitura pública; escrita só do dono; imagem/vídeo `< 10MB` (avatar `< 5MB`); mídia imutável (nova mídia = novo objeto).

---

## Como Rodar

**Pré-requisitos:** Node.js 20+, Java 11+ (mobile usa `jvmTarget = 11`), Android Studio Ladybug+, Firebase CLI.

### Mobile (Android)
```bash
cd mobile
./gradlew assembleDebug          # build de debug
./gradlew bundleRelease          # AAB assinado (requer key.properties)
```
> Release/AAB e bump de versão: use a skill `android-build-release`. `google-services.json` deve estar em `mobile/app/`.

### Web (3 apps Angular)
```bash
cd pulsar-web && npm install && npm start   # usuário  → http://localhost:4201
cd pulsar-site && npm install && npm start   # site     → http://localhost:4200
cd admin && npm install && npm start         # admin    → http://localhost:4301
# build de produção em cada app:
npm run build                                # saída em dist/<app>/browser
```

### Firebase (rules e índices)
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

### Deploy do site institucional
Docker + nginx edge (`pulsar.appsx.com.br`). Use a skill `pulsar-deploy` ou [scripts/publish-pulsar.sh](scripts/publish-pulsar.sh).

---

## Scripts utilitários ([scripts/](scripts/))

| Script | Função |
|---|---|
| `create-default-user.js` | Cria `admin@pulsar.app` via Identity Toolkit REST |
| `seed-posts.js` | Popula N posts de teste num raio (TTL 48h) — `--count`, `--dry-run` |
| `clean-legacy-media-urls.js` | Zera `imageUrl/videoUrl` legados que não são `https://` (bug de URI local) |
| `publish-pulsar.sh` | Publica `pulsar-site` no servidor appsx (Docker) |

---

## Status do MVP

- [x] Firebase Auth (mobile + web; email/senha + anônimo)
- [x] Mapa com posts ativos (mobile OSMDroid, web Leaflet)
- [x] Criação de post com geolocalização, título e agendamento (`startsAt`)
- [x] TTL configurável 1–72h (nativo + rules), padrão via `/config/global`
- [x] Mídia (imagem/vídeo) via Firebase Storage
- [x] Likes e comentários
- [x] Painel admin: moderação, usuários, reports, métricas, config, audit log
- [x] Site institucional + deploy Docker
- [ ] Notificações push (FCM) e geofencing
- [ ] Cloud Functions (denormalização server-side, moderação automática)
- [ ] Verificação social ("Confirmar Presença")

---

## ⚠️ Débitos técnicos conhecidos

1. 🔴 **[firebase/firebase.json](firebase/firebase.json)** — `hosting.public` aponta para `../web/dist/web/browser`, mas o diretório `web/` **não existe** (renomeado para `pulsar-web`). O deploy de hosting está quebrado até corrigir o path.
2. 🟠 **Segredos versionados** — `apiKey`, senha de `admin@pulsar.app` e **senha SSH do servidor** aparecem em texto puro em `scripts/seed-posts.js`, `scripts/create-default-user.js` e `scripts/publish-pulsar.sh`. Migrar para variáveis de ambiente / segredo fora do git.
3. 🟡 Contadores `likesCount`/`commentsCount` são denormalizados no cliente — sem Cloud Function, podem divergir sob concorrência. Preferir `runTransaction`/`FieldValue.increment`.
