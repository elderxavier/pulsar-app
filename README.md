# Pulsar

Aplicativo de microblogging hiperlocal efêmero. Posts duram **6 horas** e aparecem num mapa interativo baseado na localização do usuário.

---

## Visão Geral

O Pulsar permite que usuários publiquem textos curtos (até 280 caracteres) geolocalizados. Cada post expira automaticamente após 6 horas e fica visível apenas para usuários próximos à localização onde foi criado. A ideia central é criar conversas temporárias e contextuais ligadas ao espaço físico.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Mobile | Kotlin + Jetpack Compose (Android nativo) |
| Web (painel) | Angular 21 + TypeScript + TailwindCSS 4 |
| Backend / Banco | Firebase Firestore |
| Autenticação | Firebase Authentication |
| Infraestrutura | Firebase Hosting |
| Build Mobile | Gradle 8.9 (Kotlin DSL) |
| Build Web | Angular CLI 21 |

---

## Estrutura do Monorepo

```
pulsar-app/
├── mobile/                     # App Android (Kotlin + Compose)
│   ├── app/
│   │   ├── src/main/java/com/pulsar/app/
│   │   │   ├── MainActivity.kt             # Entry point + navegação
│   │   │   ├── data/
│   │   │   │   ├── model/Post.kt           # Modelo de dados
│   │   │   │   └── repository/PostRepository.kt
│   │   │   ├── ui/screens/
│   │   │   │   ├── LoginScreen.kt
│   │   │   │   ├── MapScreen.kt
│   │   │   │   └── CreatePostScreen.kt
│   │   │   ├── ui/theme/
│   │   │   └── viewmodel/
│   │   │       ├── AuthViewModel.kt
│   │   │       └── PostViewModel.kt
│   │   └── build.gradle.kts
│   ├── gradle/libs.versions.toml           # Version catalog
│   └── settings.gradle.kts
│
├── web/                        # Painel web (Angular)
│   ├── src/app/
│   │   ├── core/
│   │   │   ├── firebase.ts                 # Inicialização Firebase
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.guard.ts
│   │   │   └── posts.service.ts
│   │   ├── pages/
│   │   │   ├── login/
│   │   │   └── dashboard/
│   │   ├── app.routes.ts
│   │   └── app.config.ts
│   └── package.json
│
├── firebase/
│   ├── firestore.rules                     # Regras de segurança
│   ├── firestore.indexes.json
│   └── firebase.json
│
└── CLAUDE.md
```

---

## Modelo de Dados

### Coleção `posts` (Firestore)

```typescript
interface Post {
  id: string;           // documento ID (auto-gerado)
  content: string;      // texto do post (máx. 280 chars)
  latitude: number;
  longitude: number;
  geopoint: GeoPoint;   // campo nativo Firestore para queries geo
  userId: string;       // UID do autor (Firebase Auth)
  userName: string;     // display name do autor
  createdAt: Timestamp;
  expiresAt: Timestamp; // createdAt + 6h (forçado pelas rules)
}
```

---

## Regras de Segurança (Firestore)

| Operação | Regra |
|---|---|
| **Leitura** | Permitida para qualquer um enquanto `request.time < expiresAt` |
| **Criação** | Apenas usuários autenticados; `expiresAt` deve ser exatamente `createdAt + 6h`; conteúdo entre 1–280 chars |
| **Exclusão** | Apenas o autor do post |
| **Atualização** | Bloqueada para todos |

---

## App Mobile (Android)

### Navegação

```
login ──(auth OK)──> map ──(FAB)──> create_post
  ^──(logout/sem auth)──┘               └──(voltar)──> map
```

### Telas

- **LoginScreen** — autenticação via Firebase Auth (email/senha ou Google)
- **MapScreen** — mapa com posts ativos na região, marcadores por coordenada, FAB para criar post
- **CreatePostScreen** — campo de texto + submissão com geolocalização automática

### Permissões necessárias

```
ACCESS_FINE_LOCATION
ACCESS_COARSE_LOCATION
```

### Principais dependências (libs.versions.toml)

| Biblioteca | Versão |
|---|---|
| Kotlin | 2.0.21 |
| Jetpack Compose BOM | 2024.11.00 |
| Firebase BOM | 33.7.0 |
| Navigation Compose | 2.8.5 |
| Play Services Location | 21.3.0 |
| Android Gradle Plugin | 8.7.3 |

---

## Web (Angular)

### Rotas

| Rota | Componente | Guard |
|---|---|---|
| `/login` | LoginComponent | — |
| `/dashboard` | DashboardComponent | AuthGuard |

### PostsService

Escuta em tempo real os posts ativos via `onSnapshot`:

```typescript
listenActivePosts(callback): Unsubscribe
// query: expiresAt > now(), ordenado por expiresAt desc
```

### Principais dependências

| Pacote | Versão |
|---|---|
| Angular | 21.2 |
| Firebase JS SDK | 12.11 |
| TailwindCSS | 4.1 |
| TypeScript | 5.9 |

---

## Como Rodar

### Pré-requisitos

- Android Studio Ladybug ou superior
- Node.js 20+
- Java 17+
- Firebase CLI (`npm i -g firebase-tools`)

### Mobile

```bash
cd mobile
./gradlew assembleDebug
# ou abrir no Android Studio e rodar em emulador/dispositivo
```

### Web

```bash
cd web
npm install
npm start          # dev server em http://localhost:4200
npm run build      # build de produção em dist/web
```

### Firebase (regras e índices)

```bash
cd firebase
firebase deploy --only firestore:rules,firestore:indexes
```

---

## Fluxo de um Post

1. Usuário autenticado abre o app mobile.
2. Toca no FAB no mapa → abre **CreatePostScreen**.
3. Digita o texto (máx. 280 chars) e confirma.
4. O app captura latitude/longitude via `FusedLocationProviderClient`.
5. `PostRepository` grava no Firestore com `expiresAt = createdAt + 6h`.
6. As **Firestore Rules** validam o TTL de 6h na escrita (ninguém pode forjar).
7. O post aparece imediatamente no mapa para todos próximos à localização.
8. Após 6 horas, as queries com `expiresAt > now()` deixam de retornar o documento e ele some do mapa.

---

## Status do MVP

- [x] Firebase Auth (mobile + web)
- [x] Tela de mapa com localização atual (mobile)
- [x] Criação de post com geolocalização (mobile)
- [x] Regras Firestore com TTL de 6h forçado
- [x] Dashboard web com posts ativos em tempo real
- [ ] Mapa interativo no web (painel)
- [ ] Notificações push
- [ ] Moderação / denúncia de posts
- [ ] Suporte a posts com imagem
