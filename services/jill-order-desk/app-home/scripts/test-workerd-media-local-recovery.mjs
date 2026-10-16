// JILL WORK Phase 20 — REAL local workerd D1/R2 uncertain-write recovery.
// Synthetic pixels, synthetic D1/R2; no Cloudflare API or real account,
// no customer preview, no Worker deploy, no provider delete or retry.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestHarness} from 'wrangler';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../../merchant-request-detail.mjs';
import {draftWorkMediaRegistryBinding}
  from '../../work-private-media-registry.mjs';
import {
  planWorkR2AtomicIntentBatch as planBatch,
  inspectWorkR2AtomicBatchReceipt as inspectBatch,
} from '../../work-private-r2-d1-batch-plan.mjs';
import {planWorkR2LocalRecoveryObservation as recover}
  from '../../work-private-r2-local-recovery.mjs';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const SOURCE=resolve(ROOT,'services/jill-order-desk');
const CFG=resolve(APP,'workerd-phase19/wrangler.jsonc');
const conf=JSON.parse(readFileSync(CFG,'utf8'));
const NAME='jill-work-phase19-local-media-only';
const FAKE_UUID='00000000-0000-4000-8000-000000000019';
const FAKE_BUCKET='jill-phase19-local-synthetic-artwork';
const REAL_UUID='3f17c186-c794-4e00-8f20-017191373a19';
const active=[
  '0001_staff_authority.sql',
  '0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
];
const proposals=[
  '0004_work_private_media_registry.sql',
  '0005_work_r2_quota_guard.sql',
  '0006_work_r2_object_intents.sql',
];
const counts=[5,2,2,5,4,5];
const shop='jill-work.myshopify.com';
const submission='jill:11111111-2222-4333-8444-555555555555';
const now=Date.parse('2026-10-16T12:00:00.000Z');
const secret='SYNTHETIC_PHASE20_LOCAL_REFERENCE_KEY_0123456789';
const itemId='shopify-product:101';
const selectors=[0,1,2].map(index=>({scope:'item',itemId,index}));
const hash=b=>createHash('sha256').update(b).digest('hex');

function checkScope(){
  assert.equal(conf.name,NAME);
  assert.equal(conf.workers_dev,false);
  assert.equal(conf.main,'./worker.mjs');
  assert.deepEqual(conf.d1_databases,[{
    binding:'JILL_PHASE19_SYNTHETIC_D1',
    database_name:'jill-work-phase19-local-synthetic',
    database_id:FAKE_UUID,remote:false,
  }]);
  assert.deepEqual(conf.r2_buckets,[{
    binding:'JILL_PHASE19_SYNTHETIC_R2',
    bucket_name:FAKE_BUCKET,remote:false,
  }]);
  assert.notEqual(FAKE_UUID,REAL_UUID);
  assert.notEqual(FAKE_BUCKET,'jill-work-private-artwork');
  assert.deepEqual(readdirSync(resolve(SOURCE,'migrations')).sort(),active);
  for(const f of ['wrangler.jsonc','wrangler.canary.jsonc']){
    const p=JSON.parse(readFileSync(resolve(APP,f),'utf8'));
    assert.equal(p.d1_databases?.[0]?.database_id,REAL_UUID);
    assert.equal(p.r2_buckets,undefined);
    assert.equal(p.images,undefined);
  }
  for(const f of proposals)assert.match(readFileSync(
    resolve(SOURCE,'migration-plans',f),'utf8'),/INERT PROPOSAL/);
}
function split(file,sql,expected){
  const stmts=[];let parts=[],trigger=false;
  for(const line of sql.split(/\r?\n/)){
    const s=line.trim();
    if(!s||s.startsWith('--'))continue;
    assert.equal(s.includes('--'),false);
    if(parts.length===0)trigger=/^CREATE TRIGGER\b/i.test(s);
    parts.push(s);
    if(trigger?/^END;$/i.test(s):/;$/.test(s)){
      stmts.push(parts.join(' '));parts=[];trigger=false;
    }
  }
  assert.equal(parts.length,0,'Incomplete synthetic SQL '+file);
  assert.equal(stmts.length,expected,'Unexpected fixture count '+file);
  return stmts;
}
async function migrateLocal(db){
  const files=[...active,...proposals];
  for(let i=0;i<files.length;i++){
    const folder=i<active.length?'migrations':'migration-plans';
    for(const sql of split(files[i],readFileSync(resolve(
      SOURCE,folder,files[i]),'utf8'),counts[i]))
      await db.prepare(sql).run();
  }
}
checkScope();
const sharp=createRequire(resolve(ROOT,
  'tools/work-media-local/package.json'))('sharp');
const webp=await sharp({create:{
  width:88,height:60,channels:3,background:'#6a67ae',
}}).webp({quality:80}).toBuffer();
const webpSha=hash(webp);
const payload={
  version:1,operation:'custom_order.submit',submission_id:submission,
  submitted_at:'2026-10-16T10:00:00Z',
  customer:{name:'Synthetic Recovery',email:'recovery@example.invalid'},
  planning:{fulfillment:'pickup'},
  items:[{item_id:itemId,product_id:itemId,quantity:1,
    attributes:[],personalization_groups:[],
    reference_ids:[
      'jill:synthetic-absent',
      'jill:synthetic-lost-ack',
      'jill:synthetic-forged-head',
    ],
  }],request_attributes:[],reference_ids:[],
};
const detail=project({
  rawPayload:JSON.stringify(payload),submissionId:submission,
  ownerAuthorized:true,revision:1,
});
const harness=createTestHarness({root:APP,workers:[{configPath:CFG}]});
let running=false;
try{
  await harness.listen();running=true;
  const worker=harness.getWorker(NAME);
  const env=await worker.getEnv();
  assert.equal(Object.hasOwn(env,'JILL_PHASE19_SYNTHETIC_D1'),true);
  assert.equal(Object.hasOwn(env,'JILL_PHASE19_SYNTHETIC_R2'),true);
  assert.equal(Object.keys(env).some(k=>
    /SHOPIFY|SECRET|TOKEN|LIVE|JILL_ORDER_DESK_WORK_DB/.test(k)),false);
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  const r2=env.JILL_PHASE19_SYNTHETIC_R2;
  await migrateLocal(db);
  await db.prepare('INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,owner_bound_at) '+
    'VALUES (?,?,?,?,?)'
  ).bind(shop,'WORK','synthetic-phase20','synthetic-owner',
    '2026-10-16T11:00:00Z').run();
  for(const selector of selectors){
    const binding=draftWorkMediaRegistryBinding({
      detail,submissionId:submission,selector,registryKey:secret,
    });
    await db.prepare('INSERT INTO jill_work_private_media_registry '+
      '(shop,submission_id,scope,item_key,reference_index,reference_mac,'+
      'status,created_at_ms,updated_at_ms) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(shop,submission,binding.scope,binding.item_id??'',
      binding.reference_index,binding.reference_mac,
      'pending_verification',now,now).run();
  }
  const reserve=async selector=>{
    const plan=planBatch({
      shop,detail,submissionId:submission,selector,registryKey:secret,
      contentSha256:webpSha,byteLength:webp.length,nowMs:now,
    });
    const results=await db.batch(plan.statements.map(s=>
      db.prepare(s.sql).bind(...s.params)));
    assert.equal(inspectBatch({plan,results}).upload_authorized,false);
    const row=await db.prepare(
      'SELECT * FROM jill_work_r2_object_intents WHERE reservation_id=?'
    ).bind(plan.intent.reservation_id).first();
    assert.equal(row.object_key,plan.intent.object_key);
    assert.equal(row.state,'reserved');
    return row;
  };
  const count=async()=>({
    quota:await db.prepare(
      'SELECT lifetime_reserved_bytes,month_uploads,lifetime_reservations '+
      'FROM jill_work_r2_quota_guard').first(),
    intents:(await db.prepare('SELECT count(*) AS n FROM '+
      'jill_work_r2_object_intents').first()).n,
  });
  const apply=async(observation)=>{
    assert.equal(observation.upload_authorized,false);
    assert.equal(observation.preview_enabled,false);
    assert.equal(observation.auto_retry,false);
    assert.equal(observation.auto_delete,false);
    assert.equal(observation.quota_refund,false);
    assert.equal(observation.provider_authenticated,false);
    assert.equal(observation.executes_remotely,false);
    const outcome=await db.prepare(observation.statement.sql)
      .bind(...observation.statement.params).all();
    assert.equal(outcome?.success,true,'Local D1 UPDATE must succeed');
    assert.equal(outcome.results?.length,1,
      'Exactly one local state transition');
    assert.equal(outcome.results[0].state,observation.recommendation);
    return outcome.results[0];
  };
  const state=async row=>(await db.prepare(
    'SELECT state FROM jill_work_r2_object_intents WHERE reservation_id=?'
  ).bind(row.reservation_id).first()).state;

  // 1. Commit D1, crash BEFORE PUT. No object exists, but absence is
  // not proof that a remote write can be safely retried. Keep quota.
  const missing=await reserve(selectors[0]);
  assert.equal(await r2.head(missing.object_key),null);
  const absent=recover({
    intent:missing,head:null,storedBytes:undefined,nowMs:now+1000,
  });
  assert.equal(absent.recommendation,'ambiguous');
  await apply(absent);
  assert.equal(await state(missing),'ambiguous');
  assert.equal(await r2.head(missing.object_key),null);
  const afterMissing=await count();
  assert.equal(afterMissing.quota.month_uploads,1);
  assert.equal(afterMissing.quota.lifetime_reserved_bytes,webp.length);
  const repeated=await db.prepare(absent.statement.sql)
    .bind(...absent.statement.params).all();
  assert.equal(repeated.success,true);
  assert.equal(repeated.results.length,0,
    'Stale recovery observation must not transition a terminal row');

  // 2. Commit D1 and PUT but lose client ACK. Do not PUT again.
  // Independent local HEAD+full-body readback matches the original.
  const lost=await reserve(selectors[1]);
  let simulatedAckLost=false;
  try{
    const result=await r2.put(lost.object_key,new Uint8Array(webp),{
      onlyIf:{etagDoesNotMatch:'*'},storageClass:'Standard',
      sha256:webpSha,
      httpMetadata:{contentType:'application/octet-stream',
        cacheControl:'private, no-store',
        contentDisposition:'attachment'},
      customMetadata:{work_stage:'quarantine_v1',
        sha256:webpSha,reference_mac:lost.reference_mac},
    });
    assert.ok(result);
    throw Error('simulated_r2_write_ack_lost');
  }catch(error){
    assert.equal(error.message,'simulated_r2_write_ack_lost');
    simulatedAckLost=true;
  }
  assert.equal(simulatedAckLost,true);
  const head=await r2.head(lost.object_key);
  const get=await r2.get(lost.object_key);
  assert.ok(head&&get);
  const observed=Buffer.from(await get.arrayBuffer());
  assert.equal(hash(observed),webpSha);
  const matched=recover({
    intent:lost,head,storedBytes:observed,nowMs:now+1000,
  });
  assert.equal(matched.recommendation,'quarantined_unlinked');
  assert.equal(matched.reason,'local_full_readback_matches');
  await apply(matched);
  assert.equal(await state(lost),'quarantined_unlinked');
  assert.equal((await r2.head(lost.object_key)).etag,head.etag);
  // Both ambiguous and quarantined states are terminal in proposal
  // 0006, except separate explicitly audited revocation.
  for(const row of [missing,lost]){
    await assert.rejects(()=>db.prepare(
      'UPDATE jill_work_r2_object_intents SET state=?,updated_at_ms=? '+
      'WHERE reservation_id=?'
    ).bind('reserved',now+2000,row.reservation_id).run());
  }

  // 3. Server-side metadata mismatch after write: keep object in
  // quarantine, record ambiguity, do not repair/delete/retry.
  const wrong=await reserve(selectors[2]);
  const forged=await r2.put(wrong.object_key,new Uint8Array(webp),{
    onlyIf:{etagDoesNotMatch:'*'},storageClass:'Standard',
    sha256:webpSha,
    httpMetadata:{contentType:'application/octet-stream',
      cacheControl:'private, no-store',
      contentDisposition:'attachment'},
    customMetadata:{work_stage:'quarantine_v1',
      sha256:'f'.repeat(64),reference_mac:wrong.reference_mac},
  });
  assert.ok(forged);
  const wrongHead=await r2.head(wrong.object_key);
  const wrongBody=await r2.get(wrong.object_key);
  const disagreement=recover({
    intent:wrong,head:wrongHead,
    storedBytes:Buffer.from(await wrongBody.arrayBuffer()),
    nowMs:now+1000,
  });
  assert.equal(disagreement.recommendation,'ambiguous');
  await apply(disagreement);
  assert.equal(await state(wrong),'ambiguous');
  assert.ok(await r2.head(wrong.object_key),
    'Do not auto-delete a mismatching object');
  assert.throws(()=>recover({
    intent:{...wrong,object_key:'foreign'},
    head:wrongHead,storedBytes:webp,nowMs:now+1000,
  }),/work_r2_recovery_observation_not_authorized/);
  assert.throws(()=>recover({
    intent:{...wrong,state:'ambiguous'},
    head:wrongHead,storedBytes:webp,nowMs:now+1000,
  }),/work_r2_recovery_observation_not_authorized/);

  const final=await count();
  assert.equal(final.intents,3);
  assert.equal(final.quota.month_uploads,3);
  assert.equal(final.quota.lifetime_reserved_bytes,webp.length*3);
  assert.equal(final.quota.lifetime_reservations,3);
  const response=await worker.fetch(
    'http://localhost/__phase20_recover_private_artwork');
  assert.equal(response.status,404);
  await response.arrayBuffer();
  console.log('PASS WORK Phase 20 LOCAL recovery: committed-but-unwritten -> ambiguous, lost R2 acknowledgment -> HEAD+GET hash matched quarantined_unlinked, mismatched metadata -> ambiguous; terminal states/quotas preserved, no auto retry/delete/refund/public access; synthetic D1/R2 only.');
}catch(error){
  console.error('STOP Phase 20 LOCAL recovery: '+
    String(error?.message||'unverified').slice(0,360));
  process.exitCode=1;
}finally{
  if(running)await harness.close();
}
