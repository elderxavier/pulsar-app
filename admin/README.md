# Pulsar Admin Console

Console administrativo do Pulsar (Angular 21 + Firebase). Gerencia usuários, posts/pulsos, denúncias, configuração global, logs de auditoria e métricas.

> Acesso **restrito a contas Firebase Auth com custom claim `admin=true`** (e `superAdmin=true` para configurações globais).

---

## Setup

```bash
cd admin
npm install
```

### 1) Conceder admin a uma conta

Baixe a service account JSON em **Firebase Console → Project Settings → Service Accounts → Generate new private key** e salve como:

```
admin/scripts/serviceAccountKey.json     # já está no .gitignore
```

Depois rode:

```bash
# Admin comum
npm run set-admin -- you@example.com

# Super-admin (acesso a Configurações)
npm run set-admin -- you@example.com -- --super

# Revogar
npm run set-admin -- you@example.com -- --revoke
```

> A claim só é refletida no cliente após `getIdToken(true)` — o login do admin já força refresh.

### 2) Atualizar regras do Firestore

```bash
cd ..
firebase deploy --only firestore:rules
```

### 3) Rodar

```bash
cd admin
npm start            # http://localhost:4301
npm run build        # build de produção em dist/admin
```

---

## Áreas

| Rota | Descrição | Permissão |
|---|---|---|
| `/dashboard` | KPIs + heatmap geográfico | admin |
| `/users` | Banir / desbanir / promover | admin |
| `/posts` | Moderar pulsos (flag, force-expire, delete) | admin |
| `/reports` | Triagem de denúncias | admin |
| `/metrics` | Série temporal de posts | admin |
| `/logs` | Auditoria de todas as ações | admin |
| `/settings` | Config global (TTL, raio, kill-switch) | **superAdmin** |

---

## Auditoria

Toda ação destrutiva ou administrativa grava em `/audit`:

```ts
{ action, actorId, actorName, target, reason, createdAt }
```

Coleção é **append-only** pelas regras (sem update/delete).
