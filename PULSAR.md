# 🌐 PULSAR: O Radar do Agora
### Documento de Visão do Produto (MVP)
*Versão 1.0 - Conceito para Desenvolvimento Android e Web*

---

## 📋 1. Sumário Executivo
**Pulsar** é uma plataforma de microblogging hiperlocal com ciclo de vida efêmero (6 horas). O aplicativo resolve o problema da descoberta de eventos e oportunidades **ao vivo** em um raio de até 2km do usuário. Enquanto a experiência mobile (Android) foca na câmera, voz e localização em tempo real, a versão Web serve como painel administrativo para comerciantes e criadores de conteúdo.

---

## ❓ 2. O Problema
- **Mapas Digitais:** Mostram apenas o que é permanente. O food truck que acabou de chegar ou a fila do banco que zerou são invisíveis.
- **Redes Sociais:** O feed é global e atemporal. Um story sobre uma feira pode ter sido postado há 3 horas, quando já acabou.
- **Atrito na Comunicação Local:** Grupos de WhatsApp de bairro são caóticos e não possuem geolocalização precisa.

---

## 💡 3. A Solução Proposta
Um mapa interativo que **pulsa**. Quanto mais atividade recente em um local, mais forte é a cor no mapa. Posts expiram automaticamente em 6 horas, garantindo que a informação seja sempre **relevante e atual**.

---

## 📱 4. Funcionalidades Detalhadas

### A. Módulo Mobile (Android Nativo / Kotlin + Jetpack Compose)

| Funcionalidade | Descrição Técnica e UX |
| :--- | :--- |
| **Check-in por Voz** | **Widget na Tela de Bloqueio**. Segura para gravar (máx. 15s). Usa `SpeechRecognizer` API para transcrição offline/online. O texto é geolocalizado e postado automaticamente. |
| **Radar de Mapa** | Tela principal com `Google Maps SDK` ou `MapLibre`. Clusters de calor baseados em posts com menos de 6h. Filtros por categoria: 🍔 Gastronomia, 🎵 Música, 🐶 Pets Perdidos, 🚨 Emergências. |
| **Geofencing Inteligente** | Usuário define palavras-chave ("Brechó", "Promoção"). Usa `Geofencing` API para acordar o app (baixo consumo) e notificar quando o usuário entra em um raio onde essa palavra foi mencionada. |
| **Verificação Social** | Para evitar fake news, um post sobre evento na praça só ganha destaque se **3 pessoas no local** clicarem em "Confirmar Presença". |

### B. Módulo Web (Painel Pulsar PRO - React / Next.js)

| Funcionalidade | Descrição |
| :--- | :--- |
| **Dashboard do Estabelecimento** | Interface desktop para cadastrar cardápio, fotos e horário de funcionamento do food truck/loja. |
| **Flash Promo** | Botão "Criar Onda". Define um raio de alcance (ex: 500m) e uma duração (ex: 30 min). A mensagem é enviada via Push Notification para todos os usuários Android na área. |
| **Análise de Fluxo (Replay)** | Mapa temporal que permite ao comerciante ver os horários de pico de movimento no seu bairro nos últimos 7 dias (dados anonimizados). |

---

## 🧱 5. Arquitetura Técnica Sugerida

- **Backend & DB:** **Firebase** (Realtime Database ou Firestore).
    - **Motivo:** Sincronização em tempo real essencial para o "Radar". Regras de segurança para TTL (Time To Live) de 6 horas nos documentos.
- **Geoqueries:** **GeoFire** (Biblioteca para consultas de raio no Firebase).
- **Autenticação:** Firebase Auth (Login com Google / Telefone).
- **Web:** Hospedagem no **Vercel** ou **Firebase Hosting**.

---

## 💰 6. Modelo de Monetização (Estratégia Sustentável)

| Plano | Preço | Recursos |
| :--- | :--- | :--- |
| **Explorador** | Grátis | Postar eventos, ver mapa, 3 alertas de geofence. |
| **Pulsar PRO (Comerciante)** | R$ 19,90 / mês | Acesso ao Painel Web, **2 Flash Promos por dia**, destaque visual no mapa. |
| **Pulsar ONG** | Grátis | Para abrigos de animais postarem cães perdidos com destaque automático (selo solidário). |
| **API de Dados Urbanos** | Sob consulta | Venda de dados anonimizados de fluxo de pedestres e interesses para prefeituras/urbanistas. |

---

## 🎨 7. Identidade Visual

- **Nome:** Pulsar (Substantivo masculino. Estrela que emite radiação em intervalos regulares. Metáfora para o batimento cardíaco da cidade).
- **Paleta de Cores:**
    - **Background:** #0A0A0A (Preto profundo - poupa bateria e visão noturna).
    - **Destaque:** #00FFD1 (Ciano Neon - Sensação de tecnologia, urgência e energia).
- **Tipografia:** Inter (Google Fonts) - Alta legibilidade em telas pequenas.

---

## 🚀 8. Por que essa ideia é vencedora?

1.  **Barreira de Entrada Móvel:** A Web não consegue competir com a **geolocalização passiva em segundo plano** e o **reconhecimento de voz offline** do Android.
2.  **Ciclo de Vida do Conteúdo:** 6 horas de expiração elimina a poluição visual de posts velhos e incentiva o usuário a abrir o app várias vezes ao dia.
3.  **Monetização Natural:** Pequenos comércios **precisam** de clientes no momento de baixo movimento. R$ 19,90 para encher o salão em 30 minutos é um ROI (Retorno sobre Investimento) imbatível.
4.  **Impacto Social:** O módulo "Cão Perdido" com geofence pode salvar vidas de animais e criar uma comunidade mais engajada.

---
*Fim do Documento de Visão.*