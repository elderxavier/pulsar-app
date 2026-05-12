#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Aplica a custom claim `admin=true` (e opcionalmente `superAdmin=true`)
 * em uma conta Firebase Auth.
 *
 * Pré-requisitos:
 *   1) Baixe a service account em:
 *        Console Firebase → Project Settings → Service Accounts → Generate new private key
 *   2) Salve como `admin/scripts/serviceAccountKey.json` (já está no .gitignore).
 *
 * Uso:
 *   node scripts/set-admin-claim.js <email>                 # admin
 *   node scripts/set-admin-claim.js <email> --super         # admin + superAdmin
 *   node scripts/set-admin-claim.js <email> --revoke        # revoga claims
 */

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

function usage() {
  console.log('Uso: node scripts/set-admin-claim.js <email> [--super|--revoke]');
  process.exit(1);
}

const [, , emailArg, flag] = process.argv;
if (!emailArg) usage();

const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('❌ serviceAccountKey.json não encontrado em', keyPath);
  console.error('   Baixe em Console Firebase → Project Settings → Service Accounts.');
  process.exit(2);
}

const serviceAccount = require(keyPath);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(emailArg.trim());
    let claims;
    if (flag === '--revoke') {
      claims = {};
      console.log(`↩  Revogando todas as claims de ${user.email} (${user.uid})...`);
    } else if (flag === '--super') {
      claims = { admin: true, superAdmin: true };
      console.log(`⬆  Promovendo ${user.email} (${user.uid}) a SUPER-ADMIN...`);
    } else {
      claims = { admin: true };
      console.log(`⬆  Promovendo ${user.email} (${user.uid}) a admin...`);
    }
    await admin.auth().setCustomUserClaims(user.uid, claims);
    console.log('✅ Claims aplicadas:', claims);
    console.log('ℹ  O usuário precisa fazer logout/login (ou o app chamará getIdToken(true)) para ler as novas claims.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Falha:', err.message || err);
    process.exit(3);
  }
})();
