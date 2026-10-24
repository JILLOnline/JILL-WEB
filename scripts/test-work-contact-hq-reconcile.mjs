import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileActiveHqContactManifest,RESTORE_EXISTING_HQ_FLAGS,
 compareHqWorkContactCandidate} from './plan-work-contact-binding-parity.mjs';

const source=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const frozen=JSON.stringify(source);
const b=(name,type,extra={})=>({name,type,...extra});
const base=[
 b('JILL_ORDER_DESK_WORK_DB','d1',{id:
  '3f17c186-c794-4e00-8f20-017191373a19'}),
 b('SHOPIFY_API_SECRET','secret_text'),
 b('JILL_WORK_SESSION_KEY_B64','secret_text'),
 b('JILL_HQ_MERCHANT_READ_SECRET','secret_text'),
 b('JILL_HQ_MERCHANT_WRITE_SECRET','secret_text'),
 b('JILL_WORK_HOST_STAGE','plain_text',{text:'canary'}),
 b('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','plain_text',{text:'false'}),
 b('JILL_WORK_OAUTH_ENABLED','plain_text',{text:'true'}),
];
const status=['true','true','true','false','true'];
const five=RESTORE_EXISTING_HQ_FLAGS.map((name,i)=>
 b(name,'plain_text',{text:status[i]}));
const activeView={resources:{bindings:[...base,...five]}};
const candidate=reconcileActiveHqContactManifest({activeView,compiled:source});
assert.equal(candidate.status,'HOLD');
assert.equal(candidate.source_only,true);
assert.equal(candidate.secret_values_read,false);
assert.equal(candidate.upload_or_deployment_authorized,false);
assert.equal(candidate.original_candidate_unchanged,true);
assert.deepEqual(candidate.restored_existing_flag_names,
 RESTORE_EXISTING_HQ_FLAGS);
assert.equal(candidate.manifest.name,'jill-order-desk-canary-work');
assert.equal(candidate.manifest.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(candidate.manifest.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
assert.equal(JSON.stringify(source),frozen,'source must stay immutable');
for(let i=0;i<five.length;i++){
 assert.equal(candidate.manifest.vars[five[i].name],status[i],
  'must preserve actual existing boolean, not silently turn it on');
}
assert.deepEqual(candidate.manifest.secrets.required,[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET']);
assert.equal(Object.keys(candidate.manifest.vars).length,
 Object.keys(source.vars).length+five.length);
assert.equal(compareHqWorkContactCandidate({activeView,compiled:source})
 .candidate_plaintext_parity,false);
function stop(bindings,reason){
 assert.throws(()=>reconcileActiveHqContactManifest({
  activeView:{resources:{bindings}},compiled:source,
 }),new RegExp('work_contact_binding_parity_'+reason));
}
stop([...base,...five,b('UNREVIEWED_ENABLE','plain_text',{text:'true'})],
 'unreviewed_hq_plaintext_drift');
stop([...base,...five.map((x,i)=>i===1?{...x,text:'1'}:x)],
 'unreviewed_hq_plaintext_drift');
stop([...base,...five,b('JILL_WORK_CONTACT_INTAKE_ENABLED',
 'plain_text',{text:'true'})],'contact_flag_runtime_not_off');
stop([...base.filter(x=>x.name!=='JILL_WORK_SESSION_KEY_B64'),...five],
 'missing_existing_auth_secrets');
stop([...base,...five,b('UNSUPPORTED_BINDING','queue')],
 'unexpected_active_binding_type');
stop([...base,...five,b('JILL_WORK_CATALOG_ENABLED','plain_text',{text:'false'})],
 'malformed_active_bindings');
assert.throws(()=>reconcileActiveHqContactManifest({
 activeView,compiled:{...source,vars:{...source.vars,
  JILL_WORK_CATALOG_ENABLED:'true'}},
}),/work_contact_binding_parity_source_hq_flag_collision/);
console.log('PASS WORK Contact local reconciliation: all five actual boolean states restored, all HQ secret NAMES required, unknown drift denied, source immutable, no upload.');
