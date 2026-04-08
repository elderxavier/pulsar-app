# 📊 Relatório Técnico do Projeto PULSAR
### Versão 1.0 — Prova de Conceito (PoC)
**Data:** 08 de abril de 2026

---

## 1. Resumo Executivo

**Pulsar** é uma plataforma de microblogging hiperlocal com conteúdo efêmero (TTL de 6 horas). O projeto implementa uma PoC funcional com:

- **App Mobile Android** (Kotlin + Jetpack Compose)
- **Painel Web** (Angular 21 + TailwindCSS v4)
- **Backend** (Firebase: Authentication + Firestore)

O objetivo da PoC é validar as funcionalidades core: autenticação, criação de posts geolocalizados com expiração automática, e visualização em tempo real tanto no mobile quanto no painel web.

---

## 2. Arquitetura do Projeto

### 2.1 Estrutura do Monorepo

```
pulsar-app/
├── mobile/          → App Android nativo (Kotlin + Jetpack Compose)
├── web/             → Painel web administrativo (Angular 21)
├── firebase/        → Regras do Firestore, índices e configuração de hosting
├── CLAUDE.md        → Contexto e instruções do projeto
├── PULSAR.md        → Documento de Visão do Produto
└── agente.md        → Instruções técnicas passo a passo
```

### 2.2 Diagrama de Arquitetura

```
┌──────────────────┐     ┌──────────────────────┐
│  App Android      │     │   Painel Web Angular  │
│  (Kotlin/Compose) │     │   (TailwindCSS v4)    │
│                   │     │                       │
│  • LoginScreen    │     │  • LoginComponent     │
│  • MapScreen      │     │  • DashboardComponent │
│  • CreatePostScr. │     │                       │
└────────┬──────────┘     └──────────┬────────────┘
         │                           │
         │  Firebase SDK (Auth)      │  Firebase SDK (Auth)
         │  Firebase SDK (Firestore) │  Firebase SDK (Firestore)
         │                           │
         └───────────┬───────────────┘
                     │
          ┌──────────▼──────────┐
          │   Firebase Backend  │
          │                     │
          │  🔐 Authentication  │
          │     (Email/Senha)   │
          │                     │
          │  🗄️ Firestore       │
          │  └── posts (col.)   │
          │      ├── content    │
          │      ├── geopoint   │
          │      ├── createdAt  │
          │      ├── expiresAt  │
          │      ├── userId     │
          │      └── userName   │
          │                     │
          │  🌐 Hosting         │
          │  (build Angular)    │
          └─────────────────────┘
```

---

## 3. Stack Tecnológica

| Camada | Tecnologia | Versão |
|:---|:---|:---|
| **Mobile** | Kotlin + Jetpack Compose | Kotlin 2.0.21, Compose BOM 2024.11.00 |
| **Mobile SDK** | Android SDK | compileSdk 35, minSdk 26, targetSdk 35 |
| **Mobile Build** | Gradle (Kotlin DSL) | AGP 8.7.3 |
| **Web** | Angular (standalone) | 21.2.0 |
| **Web Styling** | TailwindCSS | 4.1.0 |
| **Web Build** | Angular CLI | 21.2.6 |
| **Linguagem Web** | TypeScript | 5.9.2 |
| **Auth** | Firebase Authentication | BoM 33.7.0 (mobile), SDK 12.11.0 (web) |
| **Database** | Cloud Firestore | BoM 33.7.0 (mobile), SDK 12.11.0 (web) |
| **Localização** | Google Play Services Location | 21.3.0 |
| **Navegação Mobile** | Navigation Compose | 2.8.5 |
| **Hosting** | Firebase Hosting | via firebase.json |

---

## 4. Módulo Mobile (Android)

### 4.1 Arquitetura

Arquitetura **MVVM (Model-View-ViewModel)** com:

- **Model:** `Post` data class + `PostRepository`
- **ViewModel:** `AuthViewModel` + `PostViewModel`
- **View:** Composable screens (`LoginScreen`, `MapScreen`, `CreatePostScreen`)
- **Navegação:** Jetpack Navigation Compose com 3 rotas: `login`, `map`, `create_post`

### 4.2 Componentes Implementados

| Arquivo | Linhas | Responsabilidade |
|:---|:---:|:---|
| `MainActivity.kt` | 88 | Entry point, permissões de localização, NavHost |
| `LoginScreen.kt` | 170 | Tela de login/registro com Email+Senha |
| `MapScreen.kt` | 210 | Tela principal listando posts ativos, FAB para criar post |
| `CreatePostScreen.kt` | 193 | Criação de post com captura de localização GPS |
| `AuthViewModel.kt` | 63 | Login, registro e logout via Firebase Auth |
| `PostViewModel.kt` | 60 | CRUD de posts e listener em tempo real |
| `PostRepository.kt` | 52 | Acesso ao Firestore (criar e ouvir posts) |
| `Post.kt` | 16 | Data class do modelo Post |
| `Color.kt` | 10 | Paleta de cores Pulsar (Cyan Neon + Dark) |
| `Theme.kt` | 23 | Tema Material 3 (dark color scheme) |
| **Total Mobile** | **~885** | |

### 4.3 Funcionalidades Mobile

- ✅ **Autenticação:** Login e registro por Email/Senha via Firebase Auth
- ✅ **Geolocalização:** Captura via `FusedLocationProviderClient`
- ✅ **Criação de Posts:** Texto (até 280 caracteres) + coordenadas GPS + TTL 6h automático
- ✅ **Feed em Tempo Real:** Listener do Firestore com filtro `expiresAt > now`
- ✅ **Navegação:** Flow condicional (login → mapa ↔ criar post)
- ✅ **UI Dark Theme:** Paleta #0A0A0A (fundo) + #00FFD1 (destaque ciano neon)
- ✅ **Temporizador:** Cada post exibe tempo restante (ex: "3h 42m")
- ✅ **Permissões:** Solicitação de `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION`

### 4.4 Identidade Visual Mobile

```
PulsarCyan       = #00FFD1  (Destaque principal)
PulsarBackground = #0A0A0A  (Fundo escuro profundo)
PulsarSurface    = #1A1A1A  (Cards e superfícies)
PulsarGray       = #3A3A3A  (Bordas e elementos secundários)
PulsarError      = #FF4444  (Erros)
```

---

## 5. Módulo Web (Painel Administrativo)

### 5.1 Arquitetura

Angular 21 com **standalone components**, **signals** para state management reativo, e lazy loading de rotas.

### 5.2 Componentes Implementados

| Arquivo | Linhas | Responsabilidade |
|:---|:---:|:---|
| `firebase.ts` | 8 | Inicialização do Firebase (App, Auth, Firestore) |
| `auth.service.ts` | 34 | Serviço Angular de autenticação (login, registro, logout) |
| `auth.guard.ts` | 13 | Guard de rota para proteção do dashboard |
| `posts.service.ts` | 43 | Listener de posts ativos no Firestore |
| `login.component.ts` | 38 | Componente de login/registro |
| `login.component.html` | 66 | Template do login (TailwindCSS) |
| `dashboard.component.ts` | 52 | Componente do dashboard principal |
| `dashboard.component.html` | 92 | Template do dashboard com grid de posts |
| `app.routes.ts` | 20 | Configuração de rotas com lazy loading |
| `app.config.ts` | 10 | Providers da aplicação |
| `app.ts` | 10 | Componente raiz |
| `styles.css` | 26 | Estilos globais + scrollbar customizado |
| `index.html` | 15 | HTML base com fonte Inter do Google Fonts |
| **Total Web** | **~427** | |

### 5.3 Funcionalidades Web

- ✅ **Autenticação:** Login/registro por Email+Senha
- ✅ **Auth Guard:** Proteção de rota `/dashboard` para usuários não autenticados
- ✅ **Dashboard em Tempo Real:** Visualização de posts ativos via `onSnapshot`
- ✅ **Sidebar Navegação:** Menu lateral com Radar, Posts Ativos, Flash Promo (placeholder)
- ✅ **Grid Responsivo:** Layout 1/2/3 colunas (mobile/tablet/desktop)
- ✅ **Temporizador:** Exibição do tempo restante de cada post
- ✅ **Coordenadas:** Exibição de latitude/longitude formatadas
- ✅ **Lazy Loading:** Componentes carregados sob demanda
- ✅ **UI Dark Theme:** Mesma paleta do mobile (#0A0A0A + #00FFD1)

---

## 6. Backend (Firebase)

### 6.1 Modelo de Dados — Coleção `posts`

| Campo | Tipo | Descrição |
|:---|:---|:---|
| `content` | `string` | Texto do post (máx. 280 caracteres) |
| `latitude` | `number` | Latitude GPS |
| `longitude` | `number` | Longitude GPS |
| `geopoint` | `GeoPoint` | Ponto geográfico para geo-queries futuras |
| `userId` | `string` | UID do autor (Firebase Auth) |
| `userName` | `string` | Nome do autor |
| `createdAt` | `Timestamp` | Data/hora de criação |
| `expiresAt` | `Timestamp` | `createdAt + 6 horas` (TTL) |

### 6.2 Regras de Segurança do Firestore

```
✅ READ:   Permitido se request.time < resource.data.expiresAt
✅ CREATE: Apenas autenticado + userId == auth.uid + validações de conteúdo
✅ DELETE: Apenas o dono do post (auth.uid == resource.data.userId)
❌ UPDATE: Bloqueado (posts são imutáveis após criação)
```

**Validações implementadas nas regras:**
- `content` é string, não vazia, até 280 caracteres
- `expiresAt` deve ser exatamente `createdAt + 6h` (impede manipulação do TTL)
- `userId` deve corresponder ao usuário autenticado

### 6.3 Índices Compostos

| Campos | Ordem | Uso |
|:---|:---|:---|
| `expiresAt` DESC + `createdAt` DESC | Coleção | Feed de posts ativos ordenados |
| `expiresAt` ASC + `geopoint` ASC | Coleção | Geo-queries futuras (GeoFire) |

### 6.4 Hosting

Configurado para servir o build Angular (`web/dist/web/browser`) com SPA rewrite.

---

## 7. Métricas do Projeto

### 7.1 Linhas de Código (Fonte)

| Módulo | Linhas (aprox.) |
|:---|---:|
| Mobile (Kotlin) | ~885 |
| Web (TypeScript + HTML + CSS) | ~427 |
| Firebase (regras + índices + config) | ~56 |
| Configuração (Gradle, package.json, tsconfig) | ~198 |
| **Total (sem node_modules / dist)** | **~1.566** |

### 7.2 Distribuição de Arquivos

| Tipo | Quantidade |
|:---|---:|
| Kotlin (`.kt`) | 8 |
| Kotlin Build (`.kts`) | 3 |
| TypeScript (`.ts`) | 11 |
| HTML (`.html`) | 4 |
| CSS (`.css`) | 2 |
| XML (Android) | 4 |
| JSON (config) | 7 |
| TOML (Gradle) | 1 |
| **Total** | **40** |

---

## 8. Status de Implementação vs. Requisitos

### 8.1 Requisitos da PoC (CLAUDE.md)

| # | Requisito | Status | Detalhes |
|:---:|:---|:---:|:---|
| 1 | Autenticação Firebase Auth | ✅ Completo | Email/Senha (login + registro) em ambos mobile e web |
| 2 | Tela de mapa com localização | ⚠️ Parcial | Feed de posts implementado; mapa interativo (MapLibre/Google Maps) ainda não integrado — exibe lista de posts com localização |
| 3 | Criar post de texto com geolocalização | ✅ Completo | Texto (280 chars) + GPS via FusedLocationProviderClient |
| 4 | Backend Firestore com TTL 6h | ✅ Completo | `expiresAt = createdAt + 6h`, validado nas regras de segurança |

### 8.2 Funcionalidades Extras Implementadas

| Funcionalidade | Módulo |
|:---|:---|
| Registro de novos usuários | Mobile + Web |
| Feed de posts em tempo real | Mobile + Web |
| Temporizador de expiração por post | Mobile + Web |
| Proteção de rotas (auth guard) | Web |
| Sidebar com navegação | Web |
| Tema dark com paleta neon | Mobile + Web |
| Limite de 280 caracteres com contador | Mobile |
| Avatar com inicial do nome | Mobile + Web |

### 8.3 Pendências para MVP Completo

| Funcionalidade | Prioridade | Detalhe |
|:---|:---:|:---|
| Mapa interativo (MapLibre/Leaflet) | 🔴 Alta | Substituir lista de posts por mapa com marcadores |
| Configuração Firebase real | 🔴 Alta | Credenciais placeholder em `environment.ts` e falta `google-services.json` |
| TTL automático (Firestore Policy) | 🟡 Média | Configurar política de TTL no console do Firebase para exclusão automática |
| Filtro por raio geográfico | 🟡 Média | Implementar geo-queries (GeoFire) para posts próximos |
| Check-in por voz | 🟢 Baixa | SpeechRecognizer API |
| Geofencing | 🟢 Baixa | Notificações baseadas em palavras-chave + localização |
| Flash Promo (Web) | 🟢 Baixa | Funcionalidade de promoção para comerciantes |
| Google Sign-In | 🟢 Baixa | Método alternativo de autenticação |

---

## 9. Segurança

### 9.1 Medidas Implementadas

- ✅ Regras de segurança Firestore com validação granular
- ✅ Posts imutáveis após criação (`update: false`)
- ✅ Validação de propriedade (`userId == auth.uid`)
- ✅ Validação de conteúdo (string, não vazio, ≤ 280 chars)
- ✅ Validação de TTL (exatamente `createdAt + 6h`, não manipulável pelo cliente)
- ✅ Leitura condicionada à validade do post (`expiresAt > request.time`)
- ✅ Auth guard no frontend web

### 9.2 Atenção

- ⚠️ Credenciais Firebase em `environment.ts` são placeholder (correto para o momento)
- ⚠️ `@SuppressLint("MissingPermission")` em `CreatePostScreen` e `MapScreen` — verificar permissões em runtime
- ⚠️ Não há rate limiting no Firestore (considerar para produção)

---

## 10. Decisões Técnicas Relevantes

| Decisão | Justificativa |
|:---|:---|
| **Angular 21 em vez de React+Vite** | Framework completo com roteamento nativo, standalone components e signals para reatividade |
| **TailwindCSS v4** | Framework CSS utility-first, eliminando necessidade de CSS customizado extenso |
| **Jetpack Compose** | UI declarativa moderna para Android, substituindo XML layouts |
| **Firebase BoM (Bill of Materials)** | Gerenciamento centralizado de versões Firebase no mobile |
| **Version Catalog (libs.versions.toml)** | Gerenciamento centralizado de dependências Gradle |
| **Dark Theme padrão** | Alinhado com identidade visual (#0A0A0A) e economia de bateria OLED |
| **Standalone components Angular** | Arquitetura moderna sem NgModules, com tree-shaking otimizado |
| **Signals Angular** | State management reativo e eficiente (substituindo RxJS para estado local) |
| **Compilação SDK 35** | Target Android 15 (última versão estável) |
| **minSdk 26** | Suporte desde Android 8.0 (API 26), cobrindo ~95%+ dos dispositivos |

---

## 11. Como Executar

### 11.1 Mobile

1. Criar projeto no Firebase Console
2. Habilitar Authentication (Email/Senha)
3. Criar banco Firestore
4. Baixar `google-services.json` e colocar em `mobile/app/`
5. Abrir pasta `mobile/` no Android Studio
6. Build & Run

### 11.2 Web

```bash
cd web/
npm install
# Configurar credenciais em src/environments/environment.ts
npm start    # ng serve → http://localhost:4200
```

### 11.3 Firebase (Deploy)

```bash
cd firebase/
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting   # após ng build
```

---

## 12. Conclusão

A PoC do **Pulsar** entrega com sucesso as funcionalidades core planejadas: autenticação, criação de posts geolocalizados com TTL de 6 horas, e visualização em tempo real cross-platform. A base de código é limpa (~1.560 linhas), bem organizada em monorepo, e utiliza tecnologias modernas em ambas as plataformas.

A principal lacuna é a integração do **mapa interativo** (MapLibre/Leaflet), que transformará a lista de posts na experiência "radar" visual proposta no documento de visão. Com as credenciais Firebase configuradas, o sistema está pronto para testes end-to-end.

---

*Relatório gerado em 08/04/2026 — Projeto Pulsar v1.0 PoC*
