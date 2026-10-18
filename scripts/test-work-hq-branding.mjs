import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {
  WORK_CLIENT_ID,WORK_APP_NAME,WORK_APP_LEGACY_NAME,
  assertRewardsWorkConfig,
} from './verify-rewards-work-target.mjs';

const scopes=[
  'customer_read_customers','customer_write_customers',
  'customer_read_orders','read_customers','write_customers',
  'read_orders','read_discounts','write_discounts',
].join(',');
const fixture=(name,id=WORK_CLIENT_ID)=>[
  'name = "'+name+'"',
  'client_id = "'+id+'"',
  'application_url = "https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev"',
  'handle = "jill-work-rewards"',
  'embedded = true',
  '',
  '[access_scopes]',
  'scopes = "'+scopes+'"',
  '',
].join('\n');
const prep=resolve('scripts/prepare-rewards-work-config.mjs');
const dir=mkdtempSync(join(tmpdir(),'jill-hq-work-name-'));
const path=join(dir,'shopify.app.work.toml');
const run=()=>execFileSync(process.execPath,[prep],{cwd:dir,encoding:'utf8'});
try {
  const before=fixture(WORK_APP_LEGACY_NAME);
  writeFileSync(path,before);
  run();
  const after=readFileSync(path,'utf8');
  assert.equal(assertRewardsWorkConfig(after).name,WORK_APP_NAME);
  assert.ok(after.includes('name = "'+WORK_APP_NAME+'"'));
  assert.ok(after.includes('handle = "jill-work-rewards"'));
  assert.ok(after.includes('client_id = "'+WORK_CLIENT_ID+'"'));
  assert.ok(after.includes('application_url = "https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev"'));
  assert.ok(after.includes('write_orders'));
  assert.equal((after.match(/write_orders/g)||[]).length,1);
  run();
  assert.equal(readFileSync(path,'utf8'),after,'Preparing WORK twice must be idempotent');
  for(const rejected of [
    fixture(WORK_APP_LEGACY_NAME,'ebf1a69d82f46619d2f2945faab78afa'),
    fixture('Unrelated App'),
    fixture(WORK_APP_LEGACY_NAME).replace('jill-order-desk-canary-work.jill-work-custom-orders.workers.dev','jillonlinestore.com'),
  ]) {
    writeFileSync(path,rejected);
    assert.throws(run,'Unknown or LIVE Shopify config must be refused');
    assert.equal(readFileSync(path,'utf8'),rejected,'Rejected app config must not be changed');
  }
  const validLegacy=after.replace(WORK_APP_NAME,WORK_APP_LEGACY_NAME);
  assert.equal(assertRewardsWorkConfig(validLegacy).name,WORK_APP_LEGACY_NAME);
  assert.throws(()=>assertRewardsWorkConfig(validLegacy,{requireHqName:true}),/JILL HQ/);
} finally {
  rmSync(dir,{recursive:true,force:true});
}
const page=readFileSync('services/jill-order-desk/app-home/app/routes/app.index.tsx','utf8');
const owner=readFileSync('services/jill-order-desk/app-home/app/routes/app.setup-owner.tsx','utf8');
const model=readFileSync('services/jill-order-desk/admin-home.mjs','utf8');
assert.match(page,/s-page heading="JILL HQ — WORK"/);
assert.match(owner,/s-page heading="JILL HQ — WORK \/ Owner setup"/);
assert.match(model,/title:'JILL HQ — WORK'/);
for(const title of ['Requests &amp; Operations','Customers &amp; Loyalty','Store &amp; Commerce','Team, Analytics &amp; Audit'])
  assert.ok(page.includes(title),'Missing HQ module '+title);
assert.match(page,/data.state==="staff_verified"/);
assert.match(page,/const owner=verified && data.role==="owner"/);
assert.match(page,/<Link to="\/app\/requests"/);
for(const path of ['/products','/collections','/customers','/orders'])
  assert.ok(page.includes('WORK_ADMIN}'+path),'Missing native WORK Shopify path '+path);
assert.ok(page.includes('Current coupons retain their issued terms'));
assert.ok(page.includes('Conversation</strong><small>My JILL Inbox and HQ thread · planned'));
assert.doesNotMatch(page,/jillonlinestore\.com|jill-live|\bLIVE\b/);
assert.doesNotMatch(page,/fetch\(|customer\.email|discountCodeBasicCreate|draftOrderCreate/i);
console.log('PASS JILL HQ WORK branding: exact app ID, safe name transition, idempotent config, no LIVE mutation, bounded management shell.');
