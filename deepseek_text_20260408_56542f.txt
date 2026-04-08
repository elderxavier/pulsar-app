
---

## ⚙️ Instruções Técnicas para o Agente (Passo a Passo)

### FASE 1: Inicialização e Configuração
1. **Crie a estrutura de pastas** conforme descrito acima.
2. **Inicialize o projeto Web:**
   - Execute `npm create vite@latest web -- --template react-ts`.
   - Instale TailwindCSS conforme a documentação oficial para Vite.
   - Instale Firebase SDK: `npm install firebase`.
3. **Inicialize o projeto Mobile:**
   - Use o Android Studio para criar um novo projeto com "Empty Activity (Compose)" no diretório `mobile`.
   - Adicione as dependências do Firebase no `build.gradle.kts` (BoM do Firebase, Auth, Firestore).
4. **Firebase:**
   - Forneça instruções claras no console para o usuário criar um projeto no Firebase, habilitar Auth (Google e Email/Senha) e Firestore.
   - Aguarde o usuário fornecer as credenciais `google-services.json` e variáveis de ambiente para a Web.

### FASE 2: Backend (Regras e Estrutura de Dados)
1. **Modelo de Dados (Firestore):**
   - Coleção: `posts`
   - Campos:
     - `content` (string)
     - `latitude` (number)
     - `longitude` (number)
     - `geopoint` (GeoPoint) -> Para consultas GeoFire.
     - `createdAt` (Timestamp)
     - `expiresAt` (Timestamp) -> **CRÍTICO**: Deve ser `createdAt + 6 horas`.
     - `userId` (string)
     - `userName` (string)
2. **Regra de Segurança (firestore.rules):**
   - Leitura pública de posts cujo `expiresAt > request.time`.
   - Escrita apenas autenticada.
   - **TTL Automático:** Crie uma Cloud Function ou explique como configurar a Política de TTL do Firestore no campo `expiresAt`.

### FASE 3: Implementação Mobile (Android)
1. **Mapas:** Use a biblioteca `MapLibre` (open-source) ou `Google Maps SDK`. Prefira MapLibre para evitar billing surpresa no MVP.
2. **UI Jetpack Compose:**
   - `MapScreen`: Exibe o mapa, solicita permissão de localização (`rememberLauncherForActivityResult`).
   - `FloatingActionButton` para abrir o `CreatePostScreen`.
   - `PostViewModel` com `Firestore` para salvar dados.
3. **Geolocalização:** Use `FusedLocationProviderClient`.

### FASE 4: Implementação Web (Painel Admin)
1. **Layout:** Sidebar minimalista. Tela de Login. Tela de "Posts Recentes".
2. **Funcionalidade:** Visualizar posts ativos no Firestore em tempo real.
3. **Mapa Web:** Use `react-map-gl` ou `leaflet` para exibir os mesmos pontos do mobile.

---

## 🗣️ Estilo de Comunicação do Agente
- **Modo Proativo:** Não espere o usuário pedir o próximo passo. Ao terminar uma tarefa, pergunte: *"Pronto! A autenticação mobile está funcionando. Quer que eu implemente a tela de criação de posts agora ou prefere ajustar as cores do tema Material 3 primeiro?"*
- **Modo Explicativo:** Sempre explique a lógica por trás da escolha de uma dependência (ex: *"Estou usando MapLibre em vez de Google Maps porque é open-source e não exige chave de API com cartão de crédito para testes."*).

---

## ⚠️ Tratamento de Erros Comuns
1. **Erro de Permissão de Localização:** Lembre o usuário de adicionar `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />` ao `AndroidManifest.xml`.
2. **Firebase não conecta:** Verifique se o arquivo `google-services.json` está em `mobile/app/`.
3. **Regras do Firestore bloqueando:** Peça para o usuário verificar se a data/hora do emulador/PC está correta (afeta comparações de Timestamp).

---

## 🚀 Próximos Passos (Roadmap do Agente)
Assim que a sessão iniciar, seu primeiro objetivo é guiar o usuário para:
1. Ter o Firebase criado.
2. Ter os projetos base Web e Mobile rodando localmente (mesmo que só com "Hello World").