import assert from 'node:assert/strict';
import {HQ_ACTIVE,HQ_QUOTE,HQ_DEPLOYMENT,HQ_MARKER,safeCloudReadFailure} from './stage-work-hq-connected-read-owner.mjs';
import {CONNECTED_CANDIDATE,CONNECTED_SOURCE,CONNECTED_PACKAGE,verifyConnectedUploadReceipt,
  verifyQuoteCanary,verifyConnectedAllocation,verifyOwnedActivation,certifyConnectedHealth,
  restoreConnectedOnce,readBackConnectedActivation,createConnectedActivationAttempt,inspectConnectedRelease} from './release-work-hq-connected-read-owner.mjs';
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
const attempt=createConnectedActivationAttempt({runner:CONNECTED_SOURCE,baseline,nonce});
assert.equal(attempt.retry_allowed,false,'In-memory receipt must support guarded automatic restoration before file reload');
assert.throws(()=>createConnectedActivationAttempt({runner:'wrong-source',baseline,nonce}));
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

// A failed provider read cannot hide subsequent read results or consume a
// deployment receipt. Error receipts contain fixed categories and numbers.
const privateText='SYNTHETIC_PRIVATE_TOKEN_AND_C_USER_PATH';
for(const [stderr,classification] of [
  ['Authentication error [code: 10000]','authentication_or_permission'],
  ['HTTP 429 too many requests','rate_limited'],
  ['HTTP 503','provider_server_error'],['HTTP 404','resource_not_found'],
  ['fetch failed ECONNRESET','network_or_tls'],['Unknown argument: json','argument_or_config'],
]){
  const diagnostic=safeCloudReadFailure({status:1,stderr:stderr+' '+privateText});
  assert.equal(diagnostic.classification,classification);assert(!JSON.stringify(diagnostic).includes(privateText));
}
assert.equal(safeCloudReadFailure({error:{code:'ETIMEDOUT'}}).classification,'command_timeout');
let readCalls=0,healthCalls=0;
const partial=await inspectConnectedRelease({activationReceiptPresent:false,restoreReceiptPresent:false,
  async readMetadata(args){readCalls++;assert.ok(['versions','deployments'].includes(args[0]));
    assert.ok(['view','list'].includes(args[1]));
    const error=Error(privateText);error.safeCliDiagnostic={classification:'authentication_or_permission',api_codes:[10000]};throw error;},
  async readHealth(){healthCalls++;throw Error(privateText);}});
assert.equal(readCalls,5);assert.equal(healthCalls,1);assert.equal(partial.metadata_verified,false);
assert.equal(partial.activation_receipt_present,false);assert.equal(partial.no_upload_or_deployment,true);
assert(!JSON.stringify(partial).includes(privateText));assert.equal(partial.reads.length,5);
old.resources.script={etag:'old',handlers:['fetch']};
old.resources.script_runtime={compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat']};
const inspectedCandidate={id:CONNECTED_CANDIDATE,annotations:{'workers/message':HQ_MARKER+CONNECTED_SOURCE},
  resources:{bindings:[...bindings,
    ...Object.entries({JILL_WORK_CATALOG_ENABLED:'true',JILL_WORK_CONVERSATION_ENABLED:'false',JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false'})
      .map(([name,text])=>({name,type:'plain_text',text})),{name:'CF_VERSION_METADATA',type:'version_metadata'}],
    script:{etag:'new',handlers:['fetch']},script_runtime:old.resources.script_runtime}};
const wire=[{id:HQ_DEPLOYMENT,created_on:'2026-10-17T19:27:35.355412Z',
  versions:baseline.versions.map(x=>({version_id:x.id,percentage:x.percentage}))}];
const complete=await inspectConnectedRelease({activationReceiptPresent:false,restoreReceiptPresent:false,
  async readMetadata(args){return args[0]==='deployments'?wire:
    args[2]===HQ_ACTIVE?old:args[2]===HQ_QUOTE?quote:inspectedCandidate;},
  async readHealth(expected){assert.equal(expected,null);return {status:200,exact_version_verified:false};}});
assert.equal(complete.metadata_verified,true);assert.equal(complete.allocation.deployment,HQ_DEPLOYMENT);
assert.equal(complete.reads.every(x=>x.ok),true);assert.equal(complete.operational_acceptance,false);
console.log('PASS exact WORK HQ activation: spent upload identity, quote canary preservation, runtime attribution, lost CLI ack read-back, single restoration and hold on concurrent deployment/read outage. No provider calls.');
console.log('PASS independent read-only inspector: five safe read results despite failure, private error text excluded, no deployment/receipt mutation capability.');
