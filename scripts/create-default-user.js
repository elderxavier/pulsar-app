#!/usr/bin/env node
/**
 * Cria o usuário padrão no Firebase Authentication via REST API.
 * Uso: node scripts/create-default-user.js
 */

const API_KEY = 'AIzaSyD3iZLF6n8SoBty-i9bOYxKHd84-ujVdfY';

const DEFAULT_USER = {
  email: 'admin@pulsar.app',
  password: 'Pulsar@2026',
  displayName: 'Administrador',
};

async function createUser({ email, password, displayName }) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'Erro desconhecido');
  }

  return data;
}

(async () => {
  console.log(`Criando usuário: ${DEFAULT_USER.email} ...`);
  try {
    const result = await createUser(DEFAULT_USER);
    console.log('Usuário criado com sucesso!');
    console.log(`  UID: ${result.localId}`);
    console.log(`  Email: ${result.email}`);
    console.log(`  Senha: ${DEFAULT_USER.password}`);
  } catch (err) {
    if (err.message === 'EMAIL_EXISTS') {
      console.log('Usuário já existe no Firebase.');
    } else {
      console.error('Erro:', err.message);
      process.exit(1);
    }
  }
})();
