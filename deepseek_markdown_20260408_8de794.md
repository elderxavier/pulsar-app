# CLAUDE.md

## 🧠 Contexto do Projeto: PULSAR
Você é um engenheiro de software sênior full-stack encarregado de construir o MVP do **Pulsar**.
**Pulsar** é um aplicativo de microblogging hiperlocal efêmero. Posts duram apenas 6 horas em um mapa interativo baseado na localização do usuário.

### 🎯 Objetivo da Sessão
Inicializar o monorepo do projeto, configurar o ambiente de desenvolvimento e construir a **Prova de Conceito (PoC)** com as seguintes funcionalidades críticas:
1. Autenticação de usuário (Firebase Auth).
2. Tela de mapa (Android com Jetpack Compose) mostrando a localização atual.
3. Capacidade de criar um "Post de Texto" simples com geolocalização.
4. Backend (Firestore) com regra TTL para expirar documentos em 6h.

---

## 🏗️ Stack Tecnológica Obrigatória
- **Frontend Mobile:** Kotlin + Jetpack Compose (Android Nativo).
- **Frontend Web:** React + TypeScript + Vite + TailwindCSS.
- **Backend & Banco de Dados:** Firebase (Authentication, Firestore, Hosting).
- **Gerenciamento de Pacotes:** npm (Web), Gradle (Android).
- **Estrutura:** Monorepo simples com pastas `/mobile` e `/web`.

---

## 📁 Estrutura de Pastas Esperada