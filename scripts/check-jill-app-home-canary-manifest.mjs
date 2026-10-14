import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const file=fileURLToPath(new URL(
  '../services/jill-order-desk/app-home/dist/server/wrangler.json',
  import.meta.url));
assert.ok(existsSync(file),'No compiled Cloudflare canary manifest');
const config=JSON.parse(readFileSync(file,'utf8'));
assert.equal(config.name,'jill-order-desk-canary-work',
  'Do not deploy a build targeting the existing WORK merchant Worker');
assert.equal(config.vars?.JILL_WORK_HOST_STAGE,'canary');
assert.equal(config.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false',
  'Owner registration must remain disabled during canary infrastructure verification');
assert.ok(Array.isArray(config.compatibility_flags));
assert.ok(config.compatibility_flags.includes('nodejs_compat'));
assert.equal(config.d1_databases?.length,1);
assert.equal(config.d1_databases[0].binding,'JILL_ORDER_DESK_WORK_DB');
assert.equal(config.d1_databases[0].database_name,'jill-order-desk-work');
assert.equal(config.d1_databases[0].database_id,
  '3f17c186-c794-4e00-8f20-017191373a19');
assert.ok(!Object.hasOwn(config.vars||{},'SHOPIFY_API_SECRET'));
assert.ok(!Object.hasOwn(config.vars||{},'JILL_WORK_SESSION_KEY_B64'));
assert.equal(typeof config.main,'string');
assert.ok(existsSync(resolve(dirname(file),config.main)),
  'Compiled Worker entrypoint is missing');
console.log('PASS isolated WORK canary manifest: exact Worker name, pinned D1, disabled Owner bootstrap, no plaintext credentials, bundled server entrypoint.');
