// Offline Phase 23 read-only Cloudflare preflight regression.
// No Wrangler, Cloudflare APIs, keys, storage, downloads or D1 calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {summarizeWorkMediaReadOnlyPreflight as summarize}
  from './inspect-work-hq-media-release-preflight.mjs';

const p=[
  'PASS: Correct WORK Cloudflare account, WORK D1 and Standard R2 bucket.',
  'PASS: Bucket is empty (0 objects, 0 B) with no public r2.dev URL or custom domains.',
  'PASS: Local-only R2 binding is remote:false; WORK/canary deploy configs have no R2 binding.',
  'HOLD: No account-wide storage/operation quota, customer storage or previews authorized.',
  'READ ONLY: No Cloudflare mutations, object reads, D1 writes, deployments or billing changes.',
].join('\n');
const a=[
  'PASS Cloudflare R2 read-only account analytics fetched (NOT billing certification).',
  'Observed UTC month: 2026-10',
  'Observed Standard storage bytes: 0',
  'Observed Standard objects: 0',
  'Observed other-class bytes: 0',
  'Observed R2 requests in current UTC month: 7',
  'Observed operation types: 3',
  '  HeadBucket: 2',
  '  ListBuckets: 4',
  '  PutBucket: 1',
  'HOLD: Analytics may be delayed/sampled and are not an authoritative account billing cap.',
  'READ ONLY: No secrets printed, deployments, D1/R2 object writes, uploads or previews.',
].join('\n');
let count=0;
function ok(x=a,y=p){
  const r=summarize({privacyOutput:y,accountOutput:x});
  assert.equal(r.state,'read_only_work_privacy_and_account_analytics_observed');
  assert.equal(r.target_work_bucket_private_and_empty,true);
  assert.equal(r.remote_r2_binding_enabled,false);
  assert.equal(r.can_authorize_r2_upload,false);
  assert.equal(r.can_authorize_d1_migrations,false);
  assert.equal(r.can_authorize_deployment,false);
  assert.equal(r.completeness_and_billing_guaranteed,false);
  assert.equal(r.customer_preview_enabled,false);
  count++;
  return r;
}
function deny(x,y){
  assert.throws(()=>summarize({privacyOutput:y??p,accountOutput:x??a}),
    /^Error: work_hq_media_/);
  count++;
}
const observed=ok();
assert.equal(observed.account_requests_month_observed,7);
assert.equal(observed.account_storage_bytes_observed,0);
assert.equal(observed.observed_month_utc,'2026-10');
ok(a.replace('bytes: 0','bytes: 1048576'));
deny(a,p.replace('Bucket is empty (0 objects, 0 B)','Bucket has 1 object'));
deny(a,p.replace('r2.dev URL or custom domains','r2.dev URL enabled or custom domains'));
deny(a,p.replace('Standard R2 bucket','InfrequentAccess R2 bucket'));
deny(a.replace('account analytics fetched','other account analytics fetched'));
deny(a.replace('Observed Standard storage bytes: 0','Observed Standard storage bytes: -2'));
deny(a.replace('Observed Standard storage bytes: 0','Observed Standard storage bytes: NaN'));
deny(a.replace('Observed Standard storage bytes: 0','Observed Standard storage bytes: 5.5'));
deny(a.replace('Observed Standard objects: 0','Observed Standard objects: 999999999999999999'));
deny(a.replace('Observed UTC month: 2026-10','Observed UTC month: 2026-13'));
deny(a.replace('Observed UTC month: 2026-10','Observed UTC month: 2026-10\nObserved UTC month: 2026-10'));
deny(a.replace('Observed operation types: 3','Observed operation types: 1001'));
deny(a+'\nSTOP: forged',p);
deny(a,p+'\nSTOP: forged');
deny(a.replace('HOLD: Analytics may be delayed/sampled and are not an authoritative account billing cap.',''));
deny(a,p.replace('no R2 binding','R2 binding configured'));
deny(undefined,'');
const raw=readFileSync(fileURLToPath(new URL(
  './inspect-work-hq-media-release-preflight.mjs',import.meta.url)),'utf8');
assert.match(raw,/spawnSync\(process\.execPath,\[script,'--inspect'\]/);
assert.match(raw,/git\('status','--porcelain','--untracked-files=no'\)/);
assert.match(raw,/localWranglerBearer|read_only_private_bucket/);
assert.doesNotMatch(raw,/wrangler deploy|migrations apply|r2 object put|\.delete\(/);
console.log('PASS WORK Phase 23 OFFLINE read-only preflight: '+count+
  ' valid/invalid provider receipts; private Standard bucket and account scope required; NEVER authorizes upload, migration, deployment, or bill.');
