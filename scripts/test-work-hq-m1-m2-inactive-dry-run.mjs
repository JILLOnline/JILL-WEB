import assert from 'node:assert/strict';
import {planWorkM1M2LocalDryRun as plan}
 from '../scripts/plan-work-hq-m1-m2-inactive-dry-run.mjs';
const ACTIVE='cf8f5b5c-38fb-469d-b10d-89ab3984c44c',
 QUOTE='dbc6341f-de7f-41de-8e97-6bf971201eeb';
const plain=(name,text)=>({name,type:'plain_text',text});
const secrets=['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET']
 .map(name=>({name,type:'secret_text'}));
const bindings=[
 plain('JILL_WORK_HOST_STAGE','canary'),
 plain('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','false'),
 plain('JILL_WORK_OAUTH_ENABLED','true'),
 plain('JILL_WORK_MERCHANT_WRITES_ENABLED','true'),
 plain('JILL_WORK_HQ_DETAIL_ENABLED','true'),
 plain('JILL_WORK_CATALOG_ENABLED','true'),
 plain('JILL_WORK_CONVERSATION_ENABLED','false'),
 plain('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','false'),
 ...secrets,
 {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',
  id:'3f17c186-c794-4e00-8f20-017191373a19'},
 {name:'CF_VERSION_METADATA',type:'version_metadata'},
];
const active={id:ACTIVE,resources:{bindings,script:{handlers:['fetch']}}};
const quote={id:QUOTE,resources:{bindings:bindings.map(x=>x.name===
 'JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'?plain(x.name,'true'):x),
 script:{handlers:['fetch']}}};
const allocation={deployment:'750af09e-720f-4e17-bae5-57eb190d252d',
 versions:[{id:ACTIVE,percentage:100},{id:QUOTE,percentage:0}]};
const compiled={name:'jill-order-desk-canary-work',workers_dev:true,
 compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],
 assets:{directory:'../client'},main:'index.js',
 vars:{JILL_WORK_HOST_STAGE:'canary',JILL_WORK_OAUTH_ENABLED:'false'},
 d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
 database_name:'jill-order-desk-work',
 database_id:'3f17c186-c794-4e00-8f20-017191373a19'}]};
const data={active,quote,allocation,compiled};
const x=plan(data);
assert.equal(x.state,'LOCAL_DRY_RUN_MANIFEST_PREPARED',x.reason);
assert.equal(x.baseline_active,ACTIVE);
assert.equal(x.manifest.keep_vars,true);
assert.equal(x.manifest.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(x.manifest.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED,'false');
assert.equal(x.preserved_secret_binding_names.length,4);
assert.equal(x.upload_authorized,false);
assert.equal(x.deploy_authorized,false);
assert.equal(x.new_paid_resources_authorized,false);
assert.equal(JSON.stringify(x.manifest).includes('secret values'),false);
const deny=(field,next,reason)=>{
 const z=structuredClone(data);z[field]=next;
 const observed=plan(z);
 assert.equal(observed.state,'held',JSON.stringify(observed));
 assert.equal(observed.reason,reason);
 assert.equal(observed.manifest,null);
};
deny('allocation',{...allocation,deployment:'00000000-0000-4000-8000-000000000000'},'live_allocation_changed');
deny('active',{...active,id:'00000000-0000-4000-8000-000000000000'},'version_source_unverified');
deny('active',{...active,resources:{...active.resources,
 bindings:[...bindings,{name:'R2_MEDIA',type:'r2_bucket',bucket_name:'private'}]}},'unreviewed_active_resource_type');
deny('quote',{...quote,resources:{...quote.resources,
 bindings:quote.resources.bindings.map(x=>x.name==='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'?
 plain(x.name,'false'):x)}},'quote_canary_identity_changed');
deny('compiled',{...compiled,name:'jill-order-desk-work'},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,r2_buckets:[{binding:'NEW',bucket_name:'new-bucket'}]},'unapproved_compiled_resource');
deny('active',{...active,resources:{...active.resources,
 bindings:bindings.filter(x=>x.name!=='SHOPIFY_API_SECRET')}},'live_secret_presence_unverified');
deny('active',{...active,resources:{...active.resources,bindings:bindings.map(x=>
 x.name==='JILL_WORK_CONVERSATION_ENABLED'?plain(x.name,'true'):x)}},'required_live_stage_flag_changed');
console.log('PASS M1/M2 inactive LOCAL-only manifest: exact active allocation/binding parity, D1/secrets/OFF flags, R2/unknown rejection; no upload/deploy.');
