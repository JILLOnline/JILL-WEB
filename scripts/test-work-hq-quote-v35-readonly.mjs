// Offline test only. Does NOT call Cloudflare / run Wrangler inspector.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  verifyInspectedQuoteVersions as inspect,verifyQuoteTableReadback as tables,
  SOURCE,CANDIDATE,MARKER,
} from './inspect-work-hq-quote-v35-readonly.mjs';
import {ACTIVE,FALLBACK,FLAG} from './stage-work-hq-quote-inactive-v35.mjs';
let n=0;
const pass=fn=>{fn();n++;};
const deny=fn=>{assert.throws(fn,/quote_v35_readonly_|work_quote_stage_/);n++;};
const DB='3f17c186-c794-4e00-8f20-017191373a19';
const b=(name,text)=>({name,type:'plain_text',text});
const flags=[
  b('JILL_WORK_HOST_STAGE','canary'),
  b('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','false'),
  b('JILL_WORK_OAUTH_ENABLED','true'),
  b('JILL_WORK_HQ_DETAIL_ENABLED','true'),
  b('JILL_WORK_MERCHANT_WRITES_ENABLED','true'),
];
const original=[
  ...flags,
  ...['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
    'JILL_HQ_MERCHANT_READ_SECRET',
    'JILL_HQ_MERCHANT_WRITE_SECRET'].map(name=>({
      name,type:'secret_text',
    })),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:DB},
];
const runtime={
  compatibility_date:'2026-10-14',
  compatibility_flags:['nodejs_compat'],
  exports:{default:['fetch']},
  assets:{html_handling:'auto-trailing-slash',
    not_found_handling:'none',run_worker_first:false,revision_id:'old'},
};
const active={
  id:ACTIVE,metadata:{created_on:'2026-10-14T00:00:00Z'},
  resources:{bindings:original,script:{etag:'old-sha',handlers:['fetch']},
    script_runtime:runtime},
};
const candidate={
  id:CANDIDATE,metadata:{created_on:'2026-10-17T17:00:00Z'},
  annotations:{'workers/message':MARKER},
  resources:{
    bindings:[...original,b(FLAG,'true')],
    script:{etag:'new-sha',handlers:['fetch']},
    script_runtime:{...runtime,assets:{...runtime.assets,revision_id:'new'}},
  },
};
const fallback={id:FALLBACK,resources:{script:{etag:'fallback-sha'}}};
const versions=[active,fallback,candidate];
const good={current:ACTIVE,source:SOURCE,active,rollback:fallback,
  candidate,versions};
pass(()=>{
  const data=inspect(good);
  assert.equal(data.active_version,ACTIVE);
  assert.equal(data.rollback_version,FALLBACK);
  assert.equal(data.inactive_version,CANDIDATE);
  assert.equal(data.source_commit,SOURCE);
  assert.equal(data.traffic_changed,false);
  assert.equal(data.work_release_authorized,false);
  assert.equal(data.binary_and_remote_assets_byte_parity_proven,false);
  assert.ok(Object.isFrozen(data));
});
for(const override of [
  {current:FALLBACK},{current:null},{source:'other'},
  {active:{...active,id:FALLBACK}},
  {rollback:{...fallback,id:ACTIVE}},
  {rollback:{...fallback,resources:{}}},
  {candidate:{...candidate,id:FALLBACK}},
  {candidate:{...candidate,annotations:{}}},
  {candidate:{...candidate,annotations:{
    'workers/message':'JILL HQ WORK Quote fake'}}},
  {candidate:{...candidate,resources:{...candidate.resources,
    bindings:[...original,b(FLAG,'false')]}}},
  {candidate:{...candidate,resources:{...candidate.resources,
    bindings:original}}},
  {candidate:{...candidate,resources:{...candidate.resources,
    script:{etag:'old-sha',handlers:['fetch']}}}},
  {versions:[active,fallback]},
  {versions:[active,fallback,candidate,{...candidate,id:'duplicate',
    metadata:{created_on:'2026-10-17T17:01:00Z'}}]},
  {versions:[active,fallback,candidate,{id:'newer',
    metadata:{created_on:'2026-10-17T18:00:00Z'}}]},
])deny(()=>inspect({...good,...override}));
const valid=[{success:true,results:[
  {name:'jill_work_quote_draft_operations'},
  {name:'jill_work_quote_drafts'},
]}];
pass(()=>assert.equal(tables(valid),true));
for(const bad of [
  null,undefined,[],{},[{}],
  [{success:false,results:valid[0].results}],
  [{success:true,results:[]}],
  [{success:true,results:[valid[0].results[0]]}],
  [{success:true,results:valid[0].results.slice().reverse()}],
  [{success:true,results:[...valid[0].results,{name:'other'}]}],
  [{success:true,results:[{...valid[0].results[0],secret:'x'},
    valid[0].results[1]]}],
])deny(()=>tables(bad));
const code=readFileSync(new URL('./inspect-work-hq-quote-v35-readonly.mjs',
  import.meta.url),'utf8');
for(const marker of [
  "SOURCE='4e4acfcc56e8b3ecb558fc7e10c80301f1cc0d9b'",
  "CANDIDATE='dbc6341f-de7f-41de-8e97-6bf971201eeb'",
  "currentWorkerVersion",
  "verifyInspectedQuoteVersions",
  "verifyQuoteTableReadback",
  "'versions','view'",
  "'versions','list'",
  "'deployments','status'",
  "'d1','execute',DB,'--remote'",
  "active()===ACTIVE",
  "DO NOT upload again",
  "DO NOT",
  "No new Worker upload",
  "byte-for-byte",
]){assert.ok(code.includes(marker),'Missing inspector marker '+marker);n++;}
for(const unsafe of [
  /command\(\['versions','upload'/,
  /command\(\['versions','deploy'/,
  /command\(\['deploy'/,
  /command\(\['d1','execute'[^;]*'--file'/,
  /command\(\['secret','put'/,
  /fetch\s*\(/,
]){
  assert.doesNotMatch(code,unsafe,'unsafe remote operation');n++;
}
console.log('PASS WORK v35 independent READ-ONLY metadata audit: '+n+
  ' source/marker/active/rollback/one-new-flag/runtime/D1/no-deploy fixture guards.');
console.log('HOLD: no Cloudflare account accessed in CI; no remote script byte parity claimed or WORK traffic switch authorized.');
