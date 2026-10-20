import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {connectedBaseline,prepareConnectedManifest,verifyConnectedActive,
  inspectConnectedVersion,reserveConnectedAttempt,HQ_ACTIVE,HQ_QUOTE,HQ_DEPLOYMENT,HQ_MARKER}
  from './stage-work-hq-connected-read-owner.mjs';
const source='a'.repeat(40),id='11111111-2222-4333-8444-555555555555';
const flags={JILL_WORK_HOST_STAGE:'canary',JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',JILL_WORK_MERCHANT_WRITES_ENABLED:'true',JILL_WORK_HQ_DETAIL_ENABLED:'true'};
const secrets=['JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET','JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET'];
const db={binding:'JILL_ORDER_DESK_WORK_DB',database_name:'jill-order-desk-work',database_id:'3f17c186-c794-4e00-8f20-017191373a19'};
const base={name:'jill-order-desk-canary-work',main:'./index.js',workers_dev:true,
  compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],assets:{directory:'../client'},
  d1_databases:[db],vars:{JILL_WORK_HOST_STAGE:'canary',JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',JILL_WORK_OAUTH_ENABLED:'false'}};
const config=prepareConnectedManifest(base);
assert.deepEqual(config.vars,{...flags,JILL_WORK_CATALOG_ENABLED:'true',JILL_WORK_CONVERSATION_ENABLED:'false',JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false'});
assert.deepEqual(config.version_metadata,{binding:'CF_VERSION_METADATA'});
assert.equal(base.vars.JILL_WORK_OAUTH_ENABLED,'false');assert.equal(base.version_metadata,undefined);
for(const bad of [{...base,r2_buckets:[{binding:'ART'}]},
  {...base,services:[{binding:'UPSTREAM'}]},
  {...base,vars:{...base.vars,JILL_WORK_CONVERSATION_ENABLED:'true'}},
  {...base,name:'live-worker'},
  {...base,d1_databases:[{...db,database_id:id}]}])assert.throws(()=>prepareConnectedManifest(bad));
const allocation={deployment:HQ_DEPLOYMENT,versions:[{id:HQ_ACTIVE,percentage:100},{id:HQ_QUOTE,percentage:0}]};
connectedBaseline(allocation);
for(const bad of [{...allocation,deployment:id},{...allocation,versions:[{id:HQ_ACTIVE,percentage:99},{id:HQ_QUOTE,percentage:1}]},
  {...allocation,versions:[{id:HQ_ACTIVE,percentage:100}]}])assert.throws(()=>connectedBaseline(bad));
const bindings=[...Object.entries(flags).map(([name,text])=>({name,text,type:'plain_text'})),
  ...secrets.map(name=>({name,type:'secret_text'})),{name:db.binding,type:'d1',id:db.database_id}];
const runtime={compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],
  assets:{html_handling:'auto-trailing-slash',not_found_handling:'none',revision_id:'old'}};
const active={id:HQ_ACTIVE,resources:{bindings,script:{etag:'old',handlers:['fetch']},script_runtime:runtime}};
const candidate={id,annotations:{'workers/message':HQ_MARKER+source},resources:{bindings:[...bindings,
  ...['JILL_WORK_CATALOG_ENABLED','JILL_WORK_CONVERSATION_ENABLED','JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'].map(name=>({name,type:'plain_text',text:config.vars[name]})),
  {name:'CF_VERSION_METADATA',type:'version_metadata'}],script:{etag:'new',handlers:['fetch']},
  script_runtime:{...runtime,assets:{...runtime.assets,revision_id:'new'}}}};
verifyConnectedActive(active);assert.equal(inspectConnectedVersion({active,candidate,source}).id,id);
for(const mutate of [
  x=>x.resources.bindings.push({name:'OTHER',type:'secret_text'}),
  x=>x.resources.bindings.find(b=>b.name==='JILL_WORK_CONVERSATION_ENABLED').text='true',
  x=>x.resources.bindings.find(b=>b.name==='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED').text='true',
  x=>x.resources.bindings.find(b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true',
  x=>x.resources.bindings.find(b=>b.type==='d1').id=id,
  x=>x.resources.bindings.splice(x.resources.bindings.findIndex(b=>b.name==='SHOPIFY_API_SECRET'),1),
  x=>x.resources.script.handlers.push('scheduled'),
  x=>x.resources.script.etag='old',
  x=>x.resources.script_runtime.compatibility_date='2026-10-15',
  x=>x.resources.script_runtime.assets.run_worker_first=true,
  x=>x.annotations['workers/message']=HQ_MARKER+'b'.repeat(40),
  x=>x.id=HQ_QUOTE,
]){const bad=structuredClone(candidate);mutate(bad);assert.throws(()=>inspectConnectedVersion({active,candidate:bad,source}));}
const dir=mkdtempSync(join(tmpdir(),'jill-hq-connected-receipt-'));
try{const f=join(dir,'new-receipt.json');reserveConnectedAttempt(f,{source});const before=readFileSync(f,'utf8');
  assert.throws(()=>reserveConnectedAttempt(f,{source:'b'.repeat(40)}));assert.equal(readFileSync(f,'utf8'),before);
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('PASS WORK connected inactive-stage policy: exact 100/0 baseline, existing four secrets/D1/runtime preserved, only catalog enabled, quote/conversation OFF, no extra resources, one-use receipt cannot reset.');
