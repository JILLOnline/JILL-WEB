// WORK-only migration 0003 rehearsal. Strictly IN-MEMORY SQLite: NO remote
// D1 mutations, no Cloudflare auth, deploy, key, Google/Shopify or file I/O
// except reading local repository files. No executable release switch here.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

const DIR='services/jill-order-desk/migrations/';
const names=readdirSync(DIR).sort();
assert.deepEqual(names,[
  '0001_staff_authority.sql',
  '0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
], 'Do not allow any other migration to ride along with 0003');
const sql=readFileSync(DIR+'0003_work_verified_inbox_index.sql','utf8');
assert.match(sql,/CREATE TABLE IF NOT EXISTS jill_work_verified_inbox_index/);
assert.match(sql,/INSERT INTO jill_work_verified_inbox_index/);
assert.match(sql,/ON CONFLICT\(shop\) DO NOTHING/);
assert.equal((sql.match(/\bCREATE TABLE\b/gi)||[]).length,1);
assert.equal((sql.match(/\bINSERT INTO\b/gi)||[]).length,1);
assert.doesNotMatch(sql,/\b(?:DROP|ALTER|DELETE|UPDATE|REPLACE|ATTACH|DETACH|VACUUM)\b\s+(?:TABLE|FROM|INTO|DATABASE)?/i);
assert.doesNotMatch(sql,/res\.cloudinary|customer_email|payload_ciphertext/i);

const config=JSON.parse(readFileSync(
  'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
assert.equal(config.name,'jill-order-desk-canary-work');
assert.equal(config.d1_databases?.length,1);
assert.equal(config.d1_databases[0].database_id,
  '3f17c186-c794-4e00-8f20-017191373a19');
assert.equal(config.d1_databases[0].migrations_dir,'../migrations');
assert.ok(!Object.hasOwn(config.vars,'JILL_WORK_HQ_FAST_INBOX_ENABLED'),
  '0003 must not activate fast inbox without a separate Worker release');
const source=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts',
  'utf8');
assert.match(source,/JILL_WORK_HQ_FAST_INBOX_ENABLED==="true"/);
assert.match(source,/if\(!fast\)return await readGoogle\(\)/);
assert.match(source,/readWorkD1IndexedMerchantList/);
const proposal=readFileSync(
  'services/jill-order-desk/migration-plans/0004_work_private_media_registry.sql',
  'utf8');
assert.match(proposal,/INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION/);

const db=new DatabaseSync(':memory:');
try{
  db.exec('PRAGMA foreign_keys=ON;');
  db.exec(readFileSync(DIR+names[0],'utf8'));
  db.exec(readFileSync(DIR+names[1],'utf8'));
  // Simulate the owner's observed D1 ledger: 0001 and 0002 recorded, 0003
  // not recorded. This is a fixture, NOT an actual D1 migration ledger.
  db.exec('CREATE TABLE d1_migrations (name TEXT NOT NULL UNIQUE)');
  db.prepare('INSERT INTO d1_migrations(name) VALUES (?)')
    .run('0001_staff_authority.sql');
  db.prepare('INSERT INTO d1_migrations(name) VALUES (?)')
    .run('0002_shopify_sessions.sql');
  const tables=()=>db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' "+
    "AND name GLOB 'jill_*' ORDER BY name").all().map(x=>x.name);
  const original=[
    'jill_merchant_audit',
    'jill_merchant_authority',
    'jill_merchant_grants',
    'jill_shopify_sessions',
  ];
  assert.deepEqual(tables(),original);
  assert.deepEqual(db.prepare(
    'SELECT name FROM d1_migrations ORDER BY name').all()
    .map(x=>x.name),names.slice(0,2));
  const at='2026-10-16T08:00:00.000Z';
  db.prepare(
    'INSERT INTO jill_merchant_authority (shop,environment,app_client_id,'+
    'owner_staff_id,owner_bound_at) VALUES (?,?,?,?,?)'
  ).run('jill-work.myshopify.com','WORK','SYNTHETIC_APP','SYNTHETIC_OWNER',at);
  db.prepare(
    'INSERT INTO jill_shopify_sessions '+
    '(id,shop,payload_ciphertext,payload_nonce) VALUES (?,?,?,?)'
  ).run('synthetic:session','jill-work.myshopify.com',
    'SYNTHETIC_ENCRYPTED_BYTES','SYNTHETIC_IV');
  const authorityBefore=db.prepare('SELECT COUNT(*) n FROM jill_merchant_authority').get().n;
  const sessionsBefore=db.prepare('SELECT COUNT(*) n FROM jill_shopify_sessions').get().n;

  db.exec(sql);
  db.exec(sql); // source idempotence, not permission to execute twice remotely
  assert.deepEqual(tables(),[...original,'jill_work_verified_inbox_index']);
  const rows=db.prepare('SELECT * FROM jill_work_verified_inbox_index').all();
  assert.equal(rows.length,1);
  assert.equal(rows[0].shop,'jill-work.myshopify.com');
  assert.equal(rows[0].generation,0);
  assert.equal(rows[0].verified_payload_json,null);
  assert.equal(rows[0].verified_at_ms,0);
  assert.equal(rows[0].expires_at_ms,0);
  const indexColumns=db.prepare(
    "PRAGMA table_info('jill_work_verified_inbox_index')"
  ).all().map(x=>x.name);
  assert.deepEqual(indexColumns,[
    'shop','generation','verified_payload_json','verified_at_ms',
    'expires_at_ms',
  ]);
  assert.throws(()=>db.prepare(
    'INSERT INTO jill_work_verified_inbox_index '+
    '(shop,generation,verified_at_ms,expires_at_ms) VALUES (?,?,?,?)'
  ).run('jillonlinestore.myshopify.com',0,0,0));
  assert.throws(()=>db.prepare(
    'UPDATE jill_work_verified_inbox_index SET generation=-1'
  ).run());
  assert.throws(()=>db.prepare(
    "UPDATE jill_work_verified_inbox_index SET verified_payload_json='NOT_JSON'"
  ).run());
  assert.throws(()=>db.prepare(
    'INSERT INTO jill_work_verified_inbox_index '+
    '(shop,generation,verified_at_ms,expires_at_ms) VALUES (?,?,?,?)'
  ).run('jill-work.myshopify.com',1,0,0));
  // Existing sensitive tables & ledger preserved; Google still canonical.
  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_merchant_authority').get().n,
    authorityBefore);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_shopify_sessions').get().n,
    sessionsBefore);
  assert.equal(db.prepare(
    "SELECT name FROM d1_migrations WHERE name='0003_work_verified_inbox_index.sql'"
  ).all().length,0,
  'Running migration SQL locally does not emulate Wrangler recording 0003');
  assert.equal(db.prepare(
    'SELECT payload_ciphertext FROM jill_shopify_sessions'
  ).get().payload_ciphertext,'SYNTHETIC_ENCRYPTED_BYTES');
  assert.ok(!tables().includes('jill_work_private_media_registry'));
  console.log('PASS WORK 0003 OFFLINE rehearsal: existing four-table + two-ledger baseline, idempotent inbox index creation, single empty seed, D1 constraints, sessions/Owner protected, fast flag OFF, 0004 untouched; NO remote D1 writes.');
}finally{db.close();}
