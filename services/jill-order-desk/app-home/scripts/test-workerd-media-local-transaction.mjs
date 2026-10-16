// Phase 22: genuine LOCAL workerd WASM + WORK Owner D1 + fake private R2.
// No real Cloudflare API, no customer images, no online Shopify/Google,
// no route deployment, no financial/subscription activation.
// Tests a source-only LOCAL transaction service, never a production upload.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createTestHarness} from 'wrangler';
import {JILL_WORK_MERCHANT_CLIENT_ID}
  from '../../../../backend/jill-merchant-auth.mjs';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../../merchant-request-detail.mjs';
import {executePhase22LocalMediaTransaction as execute}
  from './phase22-local-media-transaction.mjs';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const SRC=resolve(ROOT,'services/jill-order-desk');
const EDGE=resolve(ROOT,'tools/work-media-edge');
const CFG=resolve(APP,'workerd-phase19/wrangler.jsonc');
const EDGE_CFG=resolve(EDGE,'wrangler.jsonc');
const cfg=JSON.parse(readFileSync(CFG,'utf8'));
const edgeCfg=JSON.parse(readFileSync(EDGE_CFG,'utf8'));
const UUID='00000000-0000-4000-8000-000000000019';
const REAL='3f17c186-c794-4e00-8f20-017191373a19';
const fakeName='jill-work-phase19-local-media-only';
const fakeBucket='jill-phase19-local-synthetic-artwork';
const shop='jill-work.myshopify.com';
const submissionId='jill:11111111-2222-4333-8444-555555555555';
const itemId='shopify-product:101';
const nowMs=Date.parse('2026-10-16T12:00:00.000Z');
const registryKey='SYNTHETIC_LOCAL_PHASE22_HMAC_KEY_THIS_IS_NOT_A_SECRET';
const sha=b=>createHash('sha256').update(b).digest('hex');
const active=['0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql'];
const proposed=['0004_work_private_media_registry.sql',
  '0005_work_r2_quota_guard.sql','0006_work_r2_object_intents.sql'];
const counts=[5,2,2,5,4,5];
assert.equal(cfg.name,fakeName);
assert.equal(cfg.workers_dev,false);
assert.deepEqual(cfg.d1_databases,[{
  binding:'JILL_PHASE19_SYNTHETIC_D1',
  database_name:'jill-work-phase19-local-synthetic',
  database_id:UUID,remote:false,
}]);
assert.deepEqual(cfg.r2_buckets,[{
  binding:'JILL_PHASE19_SYNTHETIC_R2',
  bucket_name:fakeBucket,remote:false,
}]);
for(const field of ['routes','route','services','vars','env','images',
  'durable_objects','kv_namespaces','queues'])
  assert.equal(cfg[field],undefined);
assert.equal(edgeCfg.name,'jill-work-edge-codec-local-only');
assert.equal(edgeCfg.r2_buckets,undefined);
assert.equal(edgeCfg.d1_databases,undefined);
assert.notEqual(UUID,REAL);
assert.notEqual(fakeBucket,'jill-work-private-artwork');
assert.deepEqual(readdirSync(resolve(SRC,'migrations')).sort(),active);
for(const name of ['wrangler.jsonc','wrangler.canary.jsonc']){
  const p=JSON.parse(readFileSync(resolve(APP,name),'utf8'));
  assert.equal(p.r2_buckets,undefined);
  assert.equal(p.images,undefined);
  assert.equal(p.d1_databases[0].database_id,REAL);
  assert.equal(p.vars.JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED,undefined);
}
for(const name of proposed)assert.match(
  readFileSync(resolve(SRC,'migration-plans',name),'utf8'),
  /INERT PROPOSAL/);
const merchantRoute=readFileSync(resolve(APP,
  'app/routes/app.requests.media.inspect.tsx'),'utf8');
assert.doesNotMatch(merchantRoute,
  /phase22-local-media-transaction|JILL_PHASE19_SYNTHETIC_R2/);
const publicEntry=readFileSync(resolve(APP,'workers/app.ts'),'utf8');
assert.doesNotMatch(publicEntry,
  /phase22-local-media-transaction|JILL_PHASE19_SYNTHETIC_R2/);
const sourceFile=readFileSync(resolve(APP,
  'scripts/phase22-local-media-transaction.mjs'),'utf8');
assert.doesNotMatch(sourceFile,/wrangler deploy|migrations apply/);
assert.equal(sourceFile.includes('provider_authenticated:false'),true);
function splitSql(text,expected){
  const arr=[];let parts=[],trigger=false;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('--'))continue;
    if(parts.length===0)trigger=/^CREATE TRIGGER\b/i.test(line);
    parts.push(line);
    if(trigger?/^END;$/.test(line):/;$/.test(line)){
      arr.push(parts.join(' '));parts=[];trigger=false;
    }
  }
  assert.equal(parts.length,0);
  assert.equal(arr.length,expected);
  return arr;
}
async function seed(db){
  const files=[...active,...proposed];
  for(let i=0;i<files.length;i++){
    const folder=i<active.length?'migrations':'migration-plans';
    const raw=readFileSync(resolve(SRC,folder,files[i]),'utf8');
    for(const statement of splitSql(raw,counts[i]))
      await db.prepare(statement).run();
  }
}
const sharp=createRequire(resolve(ROOT,
  'tools/work-media-local/package.json'))('sharp');
const sourcePng=await sharp({create:{width:96,height:64,
  channels:3,background:'#4c689e'}}).png().toBuffer();
const expectedWasmWebpResponseMime='image/webp';
const session=(id='101',owner=true,shopName=shop)=>({
  shop:shopName,isOnline:true,onlineAccessInfo:{
    associated_user:{id,account_owner:owner},
    associated_user_scope:'',
  },
});
const detail=project({
  rawPayload:JSON.stringify({
    version:1,operation:'custom_order.submit',
    submission_id:submissionId,submitted_at:'2026-10-16T11:00:00Z',
    customer:{name:'Phase22 Synthetic',email:'sample@example.invalid'},
    planning:{fulfillment:'pickup'},
    items:[{item_id:itemId,product_id:itemId,quantity:1,
      attributes:[],personalization_groups:[],
      reference_ids:Array.from({length:7},(_,i)=>
        'jill:phase22-synthetic-reference-'+i)}],
    request_attributes:[],reference_ids:[],
  }),submissionId,revision:1,ownerAuthorized:true,
});
const environment={
  marker:'phase22-local-synthetic-runner',
  database_id:UUID,bucket_name:fakeBucket,
  remote:false,workers_dev:false,name:fakeName,
};
const providerSnapshot={
  source:'synthetic_local_phase22_snapshot_only',
  storage_class:'Standard',public_dev_url_enabled:false,
  custom_domain_count:0,emulated_only:true,checked_at_ms:nowMs,
  account_bytes:0,class_a_month:0,class_b_month:0,
};
const harness=createTestHarness({root:APP,workers:[{configPath:CFG}]});
const wasm=createTestHarness({root:EDGE,workers:[{configPath:EDGE_CFG}]});
let running=false,wasmRunning=false;
try{
  await harness.listen();running=true;
  await wasm.listen();wasmRunning=true;
  const worker=harness.getWorker(fakeName);
  const env=await worker.getEnv();
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  const r2=env.JILL_PHASE19_SYNTHETIC_R2;
  assert.ok(db?.batch&&r2?.put&&r2?.get);
  await seed(db);
  await db.prepare('INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,owner_bound_at) '+
    'VALUES (?,?,?,?,?)'
  ).bind(shop,'WORK',JILL_WORK_MERCHANT_CLIENT_ID,'101',
    '2026-10-16T11:00:00Z').run();

  const codec=wasm.getWorker('jill-work-edge-codec-local-only');
  let codecCalls=0,puts=0,reads=0;
  const fetchCodec=async(mime,input)=>{
    codecCalls++;
    return codec.fetch('http://localhost/__jill_local_codec_probe',{
      method:'POST',headers:{
        'X-Jill-Synthetic-Only':'phase18',
        'Content-Type':mime,
      },body:input,
    });
  };
  const tracedR2={
    put:async(...args)=>{puts++;return r2.put(...args);},
    head:async(...args)=>{reads++;return r2.head(...args);},
    get:async(...args)=>{reads++;return r2.get(...args);},
  };
  const firstParams={environment,db,r2:tracedR2,
    shop,session:session(),detail,submissionId,
    registryKey,originalBytes:sourcePng,declaredMime:'image/png',
    fetchCodec,providerSnapshot,nowMs,stage:'canary',enabled:true,
  };
  const selected=index=>({
    ...firstParams,selector:{scope:'item',itemId,index},
  });
  const counters=async()=>({
    quota:await db.prepare('SELECT lifetime_reserved_bytes,month_uploads,'+
      'lifetime_reservations FROM jill_work_r2_quota_guard').first(),
    intents:(await db.prepare('SELECT count(*) AS n FROM '+
      'jill_work_r2_object_intents').first()).n,
  });
  const intentAt=async(index)=>db.prepare(
    'SELECT * FROM jill_work_r2_object_intents '+
    'WHERE shop=? AND submission_id=? AND reference_index=?'
  ).bind(shop,submissionId,index).first();

  // Disabled or invalid merchant authority MUST reject before any
  // JPEG/PNG bytes are decoded and BEFORE touching quota or R2.
  const noAuth=[
    {params:{...selected(0),enabled:false},code:'disabled'},
    {params:{...selected(0),stage:'work'},code:'disabled'},
    {params:{...selected(0),session:null},code:'owner_denied'},
    {params:{...selected(0),session:session('202',false)},
      code:'owner_denied'},
    {params:{...selected(0),session:session('202',true)},
      code:'owner_denied'},
    {params:{...selected(0),
      session:session('101',true,'jillonlinestore.myshopify.com')},
      code:'owner_denied'},
    {params:{...selected(0),detail:{...detail,
      submission_id:'jill:other-request'}},code:'reference_denied'},
    {params:{...selected(0),selector:{
      scope:'item',itemId:'shopify-product:other',index:0}},
      code:'reference_denied'},
    {params:{...selected(0),providerSnapshot:null},
      code:'provider_attestation_unavailable'},
    {params:{...selected(0),providerSnapshot:{
      ...providerSnapshot,public_dev_url_enabled:true}},
      code:'provider_attestation_unavailable'},
  ];
  for(const {params,code} of noAuth){
    const verdict=await execute(params);
    assert.equal(verdict.code,code);
    assert.equal(verdict.upload_authorized,false);
    assert.equal(verdict.preview_enabled,false);
    assert.equal(verdict.billing_guaranteed,false);
  }
  assert.equal(codecCalls,0);assert.equal(puts,0);
  const noQuota=await counters();
  assert.equal(noQuota.intents,0);
  assert.equal(noQuota.quota.lifetime_reserved_bytes,0);

  // Real sanitizer output must be the BYTE HASH used by D1 and R2.
  const success=await execute(selected(0));
  assert.equal(success.code,'quarantined_unlinked');
  assert.equal(success.ok,false);
  assert.equal(success.upload_authorized,false);
  assert.equal(success.preview_enabled,false);
  const one=await intentAt(0);
  assert.equal(one.state,'quarantined_unlinked');
  const stored=await r2.get(one.object_key);
  assert.ok(stored);
  const bytes=Buffer.from(await stored.arrayBuffer());
  assert.equal(sha(bytes),one.content_sha256);
  assert.equal(bytes.length,one.byte_length);
  const meta=await sharp(bytes).metadata();
  assert.equal(meta.format,'webp');
  assert.equal(meta.width,96);assert.equal(meta.height,64);
  assert.equal(meta.exif,undefined);
  assert.equal(stored.httpMetadata?.contentType,'application/octet-stream');
  assert.equal(expectedWasmWebpResponseMime,'image/webp');
  assert.equal((await counters()).intents,1);
  const putsAfterSuccess=puts;
  const duplicate=await execute(selected(0));
  assert.equal(duplicate.code,'reservation_unconfirmed');
  assert.equal(puts,putsAfterSuccess,
    'Already registered same slot must not reach a second R2 PUT');
  assert.equal((await counters()).intents,1);

  // Successful provider write followed by lost acknowledgment must never
  // attempt a second PUT; HEAD + full GET is sufficient only for
  // quarantined_unlinked, NOT a customer preview.
  const lost=await execute({...selected(1),simulateAckLoss:true});
  assert.equal(lost.code,'quarantined_unlinked');
  assert.equal((await intentAt(1)).state,'quarantined_unlinked');
  assert.equal(puts,putsAfterSuccess+1);

  // Incorrect provider custom metadata must remain permanently ambiguous.
  const mismatched=await execute({
    ...selected(2),
    mutatePutOptions:options=>{
      options.customMetadata.sha256='f'.repeat(64);
    },
  });
  assert.equal(mismatched.code,'ambiguous');
  const row2=await intentAt(2);
  assert.equal(row2.state,'ambiguous');
  assert.ok(await r2.head(row2.object_key),'Do not delete bad object');

  // Error before any R2 write also remains ambiguous with D1 quota held.
  const beforePut=puts;
  const failingR2={
    ...tracedR2,
    put:async()=>{puts++;throw Error('synthetic_provider_unavailable');},
  };
  const unavailable=await execute({...selected(3),r2:failingR2});
  assert.equal(unavailable.code,'ambiguous');
  assert.equal((await intentAt(3)).state,'ambiguous');
  assert.equal(puts,beforePut+1);
  assert.equal(await r2.head((await intentAt(3)).object_key),null);

  // Bad pixels, mislabeled MIME, stale account snapshot: no D1 quota
  // or provider write for those unreserved canonical slots.
  const prior=await counters(),oldPut=puts;
  const malformed=await execute({...selected(4),
    originalBytes:Buffer.from('<svg onload="alert(1)"/>')});
  assert.equal(malformed.code,'sanitization_failed');
  const mislabeled=await execute({...selected(5),declaredMime:'image/jpeg'});
  assert.equal(mislabeled.code,'sanitization_failed');
  const stale=await execute({...selected(6),providerSnapshot:{
    ...providerSnapshot,checked_at_ms:nowMs-300001}});
  assert.equal(stale.code,'provider_attestation_unavailable');
  assert.equal(puts,oldPut);
  assert.deepEqual(await counters(),prior);

  // Retain ALL reservations including ambiguous slots. No automatic
  // refunds; no public URLs and no new routes are exposed.
  assert.equal(prior.intents,4);
  assert.equal(prior.quota.month_uploads,4);
  assert.equal(prior.quota.lifetime_reservations,4);
  assert.ok(prior.quota.lifetime_reserved_bytes>=bytes.length*4);
  assert.equal((await worker.fetch(
    'http://localhost/app/requests/media/upload')).status,404);
  console.log('PASS WORK Phase 22 LOCAL transaction: real WASM PNG->WebP, registered WORK Owner D1 auth, exact signed-shape canonical reference, synthetic provider precheck, monotonic atomic quota+intent, conditional private fake R2 PUT+readback, lost ACK and corruption recovery, adversarial denials, no retry/refund/preview; NO remote actions.');
}catch(error){
  console.error('STOP WORK Phase 22 LOCAL transaction: '+
    String(error?.message||'unverified').slice(0,440));
  process.exitCode=1;
}finally{
  if(wasmRunning)await wasm.close();
  if(running)await harness.close();
}
