import assert from 'node:assert/strict';
import {HQ_ACTIVE,HQ_QUOTE,HQ_DEPLOYMENT} from './stage-work-hq-connected-read-owner.mjs';
import {CONNECTED_CANDIDATE,CONNECTED_SOURCE,CONNECTED_PACKAGE,verifyConnectedUploadReceipt,
  verifyQuoteCanary,verifyConnectedAllocation,verifyOwnedActivation,certifyConnectedHealth,
  restoreConnectedOnce,readBackConnectedActivation} from './release-work-hq-connected-read-owner.mjs';
const nonce='11111111-2222-4333-8444-555555555555';
const deployment='22222222-3333-4444-8555-666666666666';
const restoredId='33333333-4444-4555-8666-777777777777';
const baseline={deployment:HQ_DEPLOYMENT,versions:[{id:HQ_ACTIVE,percentage:100},{id:HQ_QUOTE,percentage:0}]};
const upload={operation:'HQ_CONNECTED_READ_V1_INACTIVE_UPLOAD',source:CONNECTED_SOURCE,
  package_sha256:CONNECTED_PACKAGE,baseline,retry_allowed:false};
verifyConnectedUploadReceipt(upload);
for(const change of [{source:'a'.repeat(40)},{package_sha256:'b'.repeat(64)},{retry_allowed:true},
  {operation:'GATEWAY_UPLOAD'},{baseline:{...baseline,deployment}}])
  assert.throws(()=>verifyConnectedUploadReceipt({...upload,...change}));
const attempt={operation:'HQ_CONNECTED_READ_V1_ACTIVATE',runner:CONNECTED_SOURCE,source:CONNECTED_SOURCE,
  package_sha256:CONNECTED_PACKAGE,candidate:CONNECTED_CANDIDATE,baseline,nonce,retry_allowed:false};
const active={deployment,versions:[{id:CONNECTED_CANDIDATE,percentage:100},{id:HQ_QUOTE,percentage:0}],
  message:'JILL HQ WORK catalog/access v1 activate '+nonce};
verifyOwnedActivation(active,attempt);
for(const change of [{message:'someone else'},{deployment:HQ_DEPLOYMENT},
  {versions:[{id:CONNECTED_CANDIDATE,percentage:100}]},
  {versions:[{id:CONNECTED_CANDIDATE,percentage:99},{id:HQ_QUOTE,percentage:1}]}])
  assert.throws(()=>verifyOwnedActivation({...active,...change},attempt));
assert.throws(()=>verifyConnectedAllocation(baseline));
const bindings=[...Object.entries({JILL_WORK_HOST_STAGE:'canary',JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',JILL_WORK_MERCHANT_WRITES_ENABLED:'true',JILL_WORK_HQ_DETAIL_ENABLED:'true'})
  .map(([name,text])=>({name,type:'plain_text',text})),
  ...['JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET','JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET']
  .map(name=>({name,type:'secret_text'})),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:'3f17c186-c794-4e00-8f20-017191373a19'}];
const old={id:HQ_ACTIVE,resources:{bindings}};
const quote={id:HQ_QUOTE,resources:{bindings:[...bindings,{name:'JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED',type:'plain_text',text:'true'}]}};
verifyQuoteCanary(old,quote);
const wrongQuote=structuredClone(quote);wrongQuote.resources.bindings.at(-1).text='false';
assert.throws(()=>verifyQuoteCanary(old,wrongQuote));
const health={status:200,location:null,mime:'application/json',cache_control:'private, no-store, max-age=0',
  runtime_version:CONNECTED_CANDIDATE,body:{ok:true,environment:'JILL_ORDER_DESK_WORK',database_ready:true,admin_ready:false}};
assert.equal(certifyConnectedHealth(health).exact_version_verified,true);
for(const change of [{runtime_version:null},{runtime_version:HQ_ACTIVE},{status:302},{location:'https://evil.example'},
  {mime:'text/html'},{cache_control:'public, max-age=60'},{body:{...health.body,database_ready:false}},
  {body:{...health.body,admin_ready:true}}])assert.throws(()=>certifyConnectedHealth({...health,...change}));

// Lost CLI acknowledgement is reconciled through provider allocation and
// independently attributed runtime GET, never a second deployment.
let commands=0,reads=0;
const observed=await readBackConnectedActivation({attempt,deploy(){commands++;throw Error('lost acknowledgement');},
  readState(){reads++;return structuredClone(active);},verifyVersions(){},
  async health(expected){assert.equal(expected,CONNECTED_CANDIDATE);return certifyConnectedHealth(health);}});
assert.equal(commands,1);assert.equal(reads,2);assert.equal(observed.command_acknowledged,false);
commands=0;
await assert.rejects(readBackConnectedActivation({attempt,deploy(){commands++;},
  readState(){throw Error('read outage');},verifyVersions(){},health(){throw Error('unreachable');}}));
assert.equal(commands,1,'A failed allocation read cannot repeat activation');

function restoreFixture({foreign=false,changed=false,lostAck=false,outage=false}={}){
  let state=structuredClone(active),readCount=0,reservations=0,deployments=0;
  if(foreign)state.message='newer deployment by another operator';
  return {get count(){return {reservations,deployments};},args:{attempt,
    readState(){readCount++;if(outage)throw Error('read outage');
      if(changed&&readCount===2)return {...state,deployment:restoredId};return structuredClone(state);},
    verifyVersions(){},checkSource(){},reserve(){reservations++;assert.equal(reservations,1);},
    deploy(id,message){deployments++;assert.equal(id,HQ_ACTIVE);
      state={deployment:restoredId,versions:baseline.versions,message};if(lostAck)throw Error('lost restore ack');},
    async health(expected){assert.equal(expected,null);return {status:200,exact_version_verified:false};},
  }};
}
for(const options of [{foreign:true},{changed:true},{outage:true}]){
  const f=restoreFixture(options);await assert.rejects(restoreConnectedOnce(f.args));
  assert.deepEqual(f.count,{reservations:0,deployments:0},'Never restore over newer/unreadable state');
}
for(const lostAck of [false,true]){
  const f=restoreFixture({lostAck}),result=await restoreConnectedOnce(f.args);
  assert.equal(result.baseline_versions_restored,true);assert.equal(result.command_acknowledged,!lostAck);
  assert.deepEqual(f.count,{reservations:1,deployments:1});
}
// Failed health after activation can restore once; a failed restore read
// remains held without another command, receipt reset or code upload.
const f=restoreFixture();f.args.health=async()=>{throw Error('health outage');};
await assert.rejects(restoreConnectedOnce(f.args));assert.deepEqual(f.count,{reservations:1,deployments:1});
console.log('PASS exact WORK HQ activation: spent upload identity, quote canary preservation, runtime attribution, lost CLI ack read-back, single restoration and hold on concurrent deployment/read outage. No provider calls.');
