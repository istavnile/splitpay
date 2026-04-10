/**
 * SplitPay — PocketBase collection setup script
 * Creates `payment_status` and `mensajes` collections with correct rules.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=yourpassword node scripts/create_collections.mjs
 *
 * Or edit the defaults below before running.
 */

const PB_URL      = process.env.PB_URL      || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'yourpassword';

async function pb(path, method = 'GET', body = null, token = '') {
  const res = await fetch(`${PB_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

async function run() {
  // 1. Authenticate as admin
  console.log('Authenticating as admin...');
  const auth = await pb('/admins/auth-with-password', 'POST', {
    identity: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  const token = auth.token;
  console.log('Admin auth OK.');

  // 2. Fetch existing collections to get real IDs
  const collections = await pb('/collections?perPage=200', 'GET', null, token);
  const byName = {};
  collections.items.forEach(c => { byName[c.name] = c.id; });

  const eventsId       = byName['events']       || 'events0000000001';
  const participantsId = byName['participants']  || 'participants001';
  const usersId        = byName['users']         || '_pb_users_auth_';

  // 3. Helper: create or skip if already exists
  async function createCollection(schema) {
    if (byName[schema.name]) {
      console.log(`  Collection '${schema.name}' already exists — skipping.`);
      return;
    }
    await pb('/collections', 'POST', schema, token);
    console.log(`  Created '${schema.name}'.`);
  }

  // 4. payment_status
  await createCollection({
    name: 'payment_status',
    type: 'base',
    schema: [
      { name: 'id_evento',   type: 'relation', required: true,  options: { collectionId: eventsId,       cascadeDelete: true, maxSelect: 1 } },
      { name: 'id_pagador',  type: 'relation', required: true,  options: { collectionId: participantsId, maxSelect: 1 } },
      { name: 'id_receptor', type: 'relation', required: true,  options: { collectionId: participantsId, maxSelect: 1 } },
      { name: 'monto',       type: 'number',   required: true },
      { name: 'creado_por',  type: 'relation', required: true,  options: { collectionId: usersId,        maxSelect: 1 } },
    ],
    listRule:   "@request.auth.id != ''",
    viewRule:   "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });

  // 5. mensajes
  await createCollection({
    name: 'mensajes',
    type: 'base',
    schema: [
      { name: 'id_evento',   type: 'relation', required: false, options: { collectionId: eventsId, maxSelect: 1 } },
      { name: 'emisor_id',   type: 'relation', required: true,  options: { collectionId: usersId,  maxSelect: 1 } },
      { name: 'receptor_id', type: 'relation', required: true,  options: { collectionId: usersId,  maxSelect: 1 } },
      { name: 'tipo',        type: 'text',     required: true },
      { name: 'contenido',   type: 'text',     required: true },
      { name: 'leido',       type: 'bool',     required: false },
    ],
    listRule:   "@request.auth.id != '' && (emisor_id = @request.auth.id || receptor_id = @request.auth.id)",
    viewRule:   "@request.auth.id != '' && (emisor_id = @request.auth.id || receptor_id = @request.auth.id)",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && (emisor_id = @request.auth.id || receptor_id = @request.auth.id)",
    deleteRule: "@request.auth.id != '' && (emisor_id = @request.auth.id || receptor_id = @request.auth.id)",
  });

  console.log('\nDone! Both collections are ready.');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
