#!/usr/bin/env node
/**
 * Limpa imageUrl/videoUrl inválidas em posts já existentes no Firestore.
 *
 * Bug histórico: o app salvava `content://media/...` (URI local do MediaStore Android)
 * direto no campo imageUrl/videoUrl. Essas URIs só valem no aparelho que gerou
 * a foto e quebram a renderização em todos os outros devices.
 *
 * Este script:
 *   1. Autentica como admin@pulsar.app (mesma do create-default-user.js).
 *   2. Lista todos os posts.
 *   3. Para cada post cujo imageUrl/videoUrl NÃO começa com "https://",
 *      faz update zerando o campo. Posts sem mídia ou já com HTTPS ficam intactos.
 *
 * Regras do Firestore (firestore.rules:62-73) permitem update de imageUrl/videoUrl
 * pelo dono OU por admin. Como o admin@pulsar.app é o autor de seeds e a maioria
 * dos posts legados foram criados pelo app de desenvolvimento, isso cobre o caso.
 * Para posts de outros usuários, o admin precisa ter custom claim ou doc em /admins.
 *
 * Uso:
 *   node scripts/clean-legacy-media-urls.js              # roda
 *   node scripts/clean-legacy-media-urls.js --dry-run    # só lista, não atualiza
 */

const API_KEY    = 'AIzaSyD3iZLF6n8SoBty-i9bOYxKHd84-ujVdfY';
const PROJECT_ID = 'pulsar-bab90';
const CREDS      = { email: 'admin@pulsar.app', password: 'Pulsar@2026' };

const DRY_RUN = process.argv.includes('--dry-run');

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function signIn() {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...CREDS, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Auth falhou: ${data.error?.message || res.status}`);
  return { uid: data.localId, idToken: data.idToken };
}

async function listAllPosts(idToken) {
  const all = [];
  let pageToken;
  do {
    const url = new URL(`${FIRESTORE}/posts`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`List failed: ${data.error?.message || res.status}`);
    (data.documents || []).forEach((d) => all.push(d));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

function getStr(doc, field) {
  const v = doc.fields?.[field];
  return v?.stringValue ?? '';
}

function isInvalid(url) {
  return url && !url.startsWith('https://');
}

async function clearFields(idToken, docName, fieldsToClear) {
  const path = docName.split('/documents/')[1];
  const url = new URL(`${FIRESTORE}/${path}`);
  fieldsToClear.forEach((f) => url.searchParams.append('updateMask.fieldPaths', f));

  const body = { fields: {} };
  fieldsToClear.forEach((f) => { body.fields[f] = { stringValue: '' }; });

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
}

(async () => {
  console.log(`Limpeza de URIs locais em posts legados${DRY_RUN ? ' (dry-run)' : ''}\n`);

  const session = await signIn();
  console.log(`Autenticado como uid=${session.uid}\n`);

  const docs = await listAllPosts(session.idToken);
  console.log(`Total de posts: ${docs.length}\n`);

  let fixed = 0;
  let skipped = 0;
  const errors = [];

  for (const doc of docs) {
    const imageUrl = getStr(doc, 'imageUrl');
    const videoUrl = getStr(doc, 'videoUrl');
    const badImage = isInvalid(imageUrl);
    const badVideo = isInvalid(videoUrl);

    if (!badImage && !badVideo) { skipped++; continue; }

    const id = doc.name.split('/').pop();
    const fields = [];
    if (badImage) fields.push('imageUrl');
    if (badVideo) fields.push('videoUrl');
    console.log(`[${id}] limpar ${fields.join(', ')}  (img="${imageUrl.slice(0, 40)}", vid="${videoUrl.slice(0, 40)}")`);

    if (DRY_RUN) { fixed++; continue; }

    try {
      await clearFields(session.idToken, doc.name, fields);
      fixed++;
    } catch (err) {
      errors.push({ id, message: err.message });
      console.log(`  ✗ ${err.message}`);
    }
  }

  console.log(`\nResumo: ${fixed} corrigidos, ${skipped} já OK, ${errors.length} erros.`);
  if (errors.length) {
    errors.forEach((e) => console.log(`  - ${e.id}: ${e.message}`));
    process.exit(1);
  }
})();
