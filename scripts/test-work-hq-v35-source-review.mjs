// Phase 32 OFFLINE source-delta invariant tests only.
// No Cloudflare, Shopify, Google, asset reads, network, migrations, billing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {reviewWorkV35RuntimeDelta as review}
  from './review-work-hq-v35-source-delta.mjs';
const pre='services/jill-order-desk/app-home/';
const allowed=[
 {status:'M',path:pre+'app/components/WorkOriginalRequestDetails.tsx'},
 {status:'M',path:pre+'app/routes.ts'},
 {status:'A',path:pre+'app/routes/app.requests.media.inspect.tsx'},
 {status:'M',path:pre+'workers/app.ts'},
];
let cases=0;
function ok(changes){
 const r=review(changes);
 assert.equal(r.source_change_count,4);
 assert.equal(r.changed_runtime_files.length,4);
 assert.equal(r.UI_only_change,false);
 assert.equal(r.new_owner_media_route_present_but_flag_off,true);
 for(const name of [
  'cloudflare_v34_source_commit_proven',
  'actual_deployed_worker_bytes_compared',
  'browser_asset_bytes_compared_to_v34',
  'deployment_authorized','version_upload_authorized',
  'rollback_executed','real_status_mutation_verified',
 ])assert.equal(r[name],false,name);
 assert.ok(Object.isFrozen(r));
 cases++;
}
function no(changes){
 assert.throws(()=>review(changes),/work_hq_v35_source_review_/);
 cases++;
}
ok(allowed);
ok([...allowed].reverse());
for(const item of [null,undefined,[],{},'string',false,
  [allowed[0]],[...allowed,allowed[0]],
  [...allowed.slice(0,3),allowed[0]],
  [...allowed.slice(0,3),{status:'D',path:allowed[3].path}],
  [...allowed.slice(0,3),{status:'A',path:allowed[3].path}],
  [...allowed.slice(0,3),{status:'M',path:pre+'app/shopify.server.ts'}],
  [...allowed.slice(0,3),{status:'M',path:pre+'app/routes/app.requests.command.tsx'}],
  [...allowed.slice(0,3),{status:'M',path:pre+'workers/app.new.ts'}],
  [...allowed.slice(0,3),{status:'M',path:'backend/custom-order-gateway.mjs'}],
  [...allowed.slice(0,3),{status:'M',path:'services/custom-order-cloudflare/handler.mjs'}],
  [...allowed.slice(0,3),{status:'M',path:pre+'wrangler.canary.jsonc'}],
  [...allowed.slice(0,3),{status:'M',path:'jillonlinestore.com'}],
  [...allowed.slice(0,3),{status:'M',path:pre+'app/../app/hidden.tsx'}],
  [...allowed.slice(0,3),{status:'M',path:pre+'app/new.tsx',code:'oops'}],
])no(item);
const script=readFileSync(fileURLToPath(new URL(
  './review-work-hq-v35-source-delta.mjs',import.meta.url)),'utf8');
for(const pattern of [
  'f75336c6520f7dd75217cc6b6815fc828083a87d',
  'source_change_count:4',
  'cloudflare_v34_source_commit_proven:false',
  'actual_deployed_worker_bytes_compared:false',
  'UI_only_change:false',
  'versions_upload_authorized:false', // intentionally not a key
]){
  if(pattern==='versions_upload_authorized:false')continue;
  assert.ok(script.includes(pattern),pattern);
}
assert.match(script,/--name-status','--no-renames','-z'/);
assert.match(script,/local_artifact_inventory_sha256/);
assert.doesNotMatch(script,
  /\['versions','upload'|\['versions','deploy'|\br2\.put\(|\bdb\.prepare\(/);
console.log('PASS WORK Phase32 OFFLINE historical source review: '+cases+
  ' cases, exact four runtime deltas and unchanged auth/gateway' +
  ' comparison scope, no false deployed binary/UI-only claim or release authority.');
