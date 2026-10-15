import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  CATALOG,CATALOG_MARKER,reconcileCatalog,localFilePath,
} from './initialize-jill-private-catalog.mjs';

// Template keys are the actual externally configured names; screenshot
// source is UNKNOWN except verified WORK QA/Cloudflare bindings.
for(const exact of [
  'JILL_HQ_MERCHANT_READ_SECRET=',
  'JILL_CUSTOM_ORDER_GATEWAY_SECRET=',
  'SHOPIFY_ACCESS_TOKEN=',
  'SHOPIFY_CLIENT_SECRET=',
  'SHOPIFY_API_SECRET=',
  'JILL_WORK_SESSION_KEY_B64=',
])assert.ok(CATALOG.includes('\n'+exact+'\n'),exact);
for(const name of [
  'JILL_CUSTOM_ORDER_ADMINS','JILL_PUBLIC_PROMOTIONS_INFRA_CHECK_AT',
  'JILL_REWARDS_INFRA_CHECK_AT','JILL_REWARDS_LAST_SWEEP',
  'JILL_SHEET_ID','SHOPIFY_CLIENT_ID','SHOPIFY_REDIRECT_URI',
  'SHOPIFY_SHOP','SHOPIFY_STORE',
])assert.ok(CATALOG.includes('# '+name));
assert.ok(CATALOG.includes('[UNASSIGNED.GOOGLE_SCRIPT_SECRETS]'));
assert.ok(CATALOG.includes('[LIVE.UNVERIFIED]'));
assert.ok(CATALOG.includes('[KEEP.UNVERIFIED]'));
assert.ok(!CATALOG.includes('SHOPIFY_WORK_API_SECRET='));
assert.ok(!CATALOG.includes('SHOPIFY_LIVE_API_SECRET='));
assert.ok(!CATALOG.includes('CLOUDFLARE_WORK_API_TOKEN='));

// Never discard, rewrite, un-scope, or print legacy values. Append only.
const old='========== JILL WORK ==========\r\nSHOPIFY_WORK_API_SECRET=sensitive-private-value!\r\nLIVE_KEY=PRIVATE_LIVE_VALUE';
const updated=reconcileCatalog(old);
assert.equal(updated.changed,true);
assert.ok(updated.content.startsWith(old+'\n'));
assert.ok(updated.content.includes('SHOPIFY_WORK_API_SECRET=sensitive-private-value!'));
assert.ok(updated.content.includes('LIVE_KEY=PRIVATE_LIVE_VALUE'));
assert.equal(updated.content.split(CATALOG_MARKER).length,2);
assert.deepEqual(reconcileCatalog(updated.content),
  {changed:false,content:updated.content,reason:'already_installed'});
assert.equal(reconcileCatalog('').content,CATALOG);
assert.equal(reconcileCatalog('  ').content,CATALOG);
assert.throws(()=>reconcileCatalog(null));

// Guard against accidentally writing under repo or common sync folders.
const home=path.join(os.tmpdir(),'jill-private-test-home');
const root=path.join(home,'source','JILL-WEB');
const normal=localFilePath({home,repo:root});
assert.equal(normal.full,path.join(home,'JILL-PRIVATE','JILL-SECRETS.txt'));
assert.throws(()=>localFilePath({home:root,repo:root}));
assert.throws(()=>localFilePath({home:path.join(home,'OneDrive'),repo:root}));
const source=fs.readFileSync('scripts/initialize-jill-private-catalog.mjs','utf8');
assert.doesNotMatch(source,/fetch\(|https\.request\(|console\.log\(existing\)|console\.log\(result\.content\)/);
assert.match(source,/COPYFILE_EXCL/);
assert.match(source,/fs\.lstatSync\(full\)\.isSymbolicLink\(\)/);
console.log('PASS JILL private local catalog: exact names, unknown LIVE/WORK quarantine, append-only and backup, no key upload, no automatic secret reading.');
