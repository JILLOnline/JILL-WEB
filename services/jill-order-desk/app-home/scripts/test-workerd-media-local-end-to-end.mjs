// JILL WORK Phase 19: REAL local workerd codec + D1 + R2 integration.
// This file is the ONLY R2 writer in Phase 19. Test-harness ONLY.
// No real WORK R2 bucket, migrations, Shopify secrets, customer files,
// HTTP storage route, payments, deployment or Cloudflare API access.
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
  planWorkR2AtomicIntentBatch as createPlan,
  inspectWorkR2AtomicBatchReceipt as inspectReceipt,
} from '../../work-private-r2-d1-batch-plan.mjs';
import {inspectWorkR2PrewriteEvidence}
  from '../../work-private-r2-prewrite-evidence.mjs';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const EDGE=resolve(ROOT,'tools/work-media-edge');
const SOURCE=resolve(ROOT,'services/jill-order-desk');
const STORAGE=resolve(APP,'workerd-phase19/wrangler.jsonc');
const EDGE_CONFIG=resolve(EDGE,'wrangler.jsonc');
const config=JSON.parse(readFileSync(STORAGE,'utf8'));
const edgeConfig=JSON.parse(readFileSync(EDGE_CONFIG,'utf8'));
const STORAGE_NAME='jill-work-phase19-local-media-only';
const EDGE_NAME='jill-work-edge-codec-local-only';
const BUCKET='jill-phase19-local-synthetic-artwork';
const UUID='00000000-0000-4000-8000-000000000019';
const LIVE_DB_UUID='3f17c186-c794-4e00-8f20-017191373a19';
const ACTIVE=['0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql'];
const PROPOSALS=['0004_work_private_media_registry.sql',
  '0005_work_r2_quota_guard.sql','0006_work_r2_object_intents.sql'];
const EXPECTED_STMTS=[5,2,2,5,4,5];
const shop='jill-work.myshopify.com';
const submissionId='jill:11111111-2222-4333-8444-555555555555';
const selector={scope:'item',itemId:'shopify-product:101',index:0};
const nowMs=Date.parse('2026-10-16T12:00:00.000Z');
const registryKey='SYNTHETIC_ONLY_PHASE19_HMAC_KEY_IS_NOT_REAL_01234';
const hash=x=>createHash('sha256').update(x).digest('hex');

function assertOnlySynthetic(){
  assert.equal(config.name,STORAGE_NAME);
  assert.equal(config.main,'./worker.mjs');
  assert.equal(config.workers_dev,false);
  assert.deepEqual(config.d1_databases,[{
    binding:'JILL_PHASE19_SYNTHETIC_D1',
    database_name:'jill-work-phase19-local-synthetic',
    database_id:UUID,remote:false,
  }]);
  assert.deepEqual(config.r2_buckets,[{
    binding:'JILL_PHASE19_SYNTHETIC_R2',
    bucket_name:BUCKET,remote:false,
  }]);
  assert.notEqual(UUID,LIVE_DB_UUID);
  assert.notEqual(BUCKET,'jill-work-private-artwork');
  for(const field of ['routes','route','services','vars','env','images',
    'durable_objects','kv_namespaces','queues'])
    assert.equal(config[field],undefined,'Synthetic config has extra '+field);
  assert.equal(edgeConfig.name,EDGE_NAME);
  assert.equal(edgeConfig.workers_dev,false);
  assert.equal(edgeConfig.r2_buckets,undefined);
  assert.equal(edgeConfig.d1_databases,undefined);
  assert.deepEqual(readdirSync(resolve(SOURCE,'migrations')).sort(),ACTIVE);
  for(const file of ['wrangler.jsonc','wrangler.canary.jsonc']){
    const live=JSON.parse(readFileSync(resolve(APP,file),'utf8'));
    assert.equal(live.r2_buckets,undefined);
    assert.equal(live.images,undefined);
    assert.equal(live.d1_databases?.length,1);
    assert.equal(live.d1_databases[0].database_id,LIVE_DB_UUID);
    assert.notEqual(live.name,STORAGE_NAME);
  }
  for(const file of PROPOSALS){
    assert.match(readFileSync(resolve(SOURCE,'migration-plans',file),'utf8'),
      /INERT PROPOSAL/);
  }
}
function preparedStatements(sql,count){
  const statements=[];let lines=[],trigger=false;
  for(const item of sql.split(/\r?\n/)){
    const line=item.trim();
    if(!line||line.startsWith('--'))continue;
    assert.equal(line.includes('--'),false);
    if(lines.length===0)trigger=/^CREATE TRIGGER\b/i.test(line);
    lines.push(line);
    if(trigger?/^END;$/i.test(line):/;$/.test(line)){
      statements.push(lines.join(' '));lines=[];trigger=false;
    }
  }
  assert.equal(lines.length,0,'No unterminated synthetic SQL');
  assert.equal(statements.length,count,'Unexpected fixture schema');
  return statements;
}
async function seed(db){
  const files=[...ACTIVE,...PROPOSALS];
  for(let i=0;i<files.length;i++){
    const dir=i<ACTIVE.length?'migrations':'migration-plans';
    const sql=readFileSync(resolve(SOURCE,dir,files[i]),'utf8');
    const statements=preparedStatements(sql,EXPECTED_STMTS[i]);
    for(const statement of statements)
      await db.prepare(statement).run();
  }
}
assertOnlySynthetic();
const requireSharp=createRequire(resolve(ROOT,
  'tools/work-media-local/package.json'));
const sharp=requireSharp('sharp');
const image=await sharp({create:{width:96,height:64,channels:3,
  background:{r:61,g:104,b:183}}}).png().toBuffer();
assert.ok(image.length>20);
const detail=project({
  rawPayload:JSON.stringify({
    version:1,operation:'custom_order.submit',submission_id:submissionId,
    submitted_at:'2026-10-16T10:00:00Z',
    customer:{name:'Phase19 Synthetic',email:'synthetic@example.invalid'},
    planning:{fulfillment:'pickup'},
    items:[{item_id:selector.itemId,product_id:selector.itemId,
      quantity:1,attributes:[],personalization_groups:[],
      reference_ids:['jill:phase19-opaque-artwork']}],
    request_attributes:[],reference_ids:[],
  }),
  submissionId,ownerAuthorized:true,revision:1,
});
const edge=createTestHarness({
  root:EDGE,workers:[{configPath:EDGE_CONFIG}],
});
const store=createTestHarness({
  root:APP,workers:[{configPath:STORAGE}],
});
let edgeListening=false,storageListening=false;
try{
  await edge.listen();edgeListening=true;
  await store.listen();storageListening=true;
  const codec=edge.getWorker(EDGE_NAME);
  const storageWorker=store.getWorker(STORAGE_NAME);
  const codecEnv=await codec.getEnv();
  assert.equal(Object.keys(codecEnv).some(k=>/R2|D1|SHOPIFY|SECRET/.test(k)),
    false);
  const env=await storageWorker.getEnv();
  assert.deepEqual(Object.keys(env).sort(),[
    'JILL_PHASE19_SYNTHETIC_D1','JILL_PHASE19_SYNTHETIC_R2',
  ]);
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  const bucket=env.JILL_PHASE19_SYNTHETIC_R2;
  for(const name of ['put','head','get'])
    assert.equal(typeof bucket[name],'function');
  assert.equal(typeof db.batch,'function');
  await seed(db);

  // Actual local Worker codec produces NEW WebP, not the original PNG.
  const res=await codec.fetch(
    'http://localhost/__jill_local_codec_probe',{
      method:'POST',headers:{
        'X-Jill-Synthetic-Only':'phase18',
        'Content-Type':'image/png',
      },body:image,
    });
  assert.equal(res.status,200,'Real local sanitizer must pass');
  assert.equal(res.headers.get('Content-Type'),'image/webp');
  assert.equal(res.headers.get('X-Jill-Persisted'),'false');
  const webp=Buffer.from(await res.arrayBuffer());
  const output=await sharp(webp).metadata();
  assert.equal(output.format,'webp');
  assert.equal(output.width,96);assert.equal(output.height,64);
  assert.equal(output.exif,undefined);
  const sha=hash(webp);

  // Only synthetic account/Shopify and synthetic D1 are used here.
  await db.prepare('INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,owner_bound_at) '+
    'VALUES (?,?,?,?,?)'
  ).bind(shop,'WORK','phase19-test-only','phase19-test-owner',
    '2026-10-16T10:00:00Z').run();
  const bound=draftWorkMediaRegistryBinding({
    detail,submissionId,selector,registryKey,
  });
  await db.prepare('INSERT INTO jill_work_private_media_registry '+
    '(shop,submission_id,scope,item_key,reference_index,reference_mac,'+
    'status,created_at_ms,updated_at_ms) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(shop,submissionId,bound.scope,bound.item_id??'',
    bound.reference_index,bound.reference_mac,
    'pending_verification',nowMs,nowMs).run();

  const plan=()=>createPlan({
    shop,detail,submissionId,selector,registryKey,
    contentSha256:sha,byteLength:webp.byteLength,nowMs,
  });
  const draft=plan();
  const r2key=draft.intent.object_key;
  assert.equal(await bucket.head(r2key),null,
    'Nothing may reach storage before a persisted intent');

  // Phase 16 still forbids production: mock evidence and absent real
  // account billing never become legitimate R2 upload authority.
  assert.throws(()=>inspectWorkR2PrewriteEvidence({
    plan:draft,batchResults:[],sanitizedBytes:webp,
    declaredMime:'image/webp',nowMs,
  }),/work_r2_prewrite_evidence_unverified/);
  assert.equal(await bucket.head(r2key),null);

  // The real LOCAL D1 binding persists quota and intent in ONE batch.
  const result=await db.batch(draft.statements.map(s=>
    db.prepare(s.sql).bind(...s.params)));
  const receipt=inspectReceipt({plan:draft,results:result});
  assert.equal(receipt.state,'server_only_intent_reserved_not_uploaded');
  assert.equal(receipt.upload_authorized,false);
  const row=await db.prepare('SELECT * FROM jill_work_r2_object_intents '+
    'WHERE reservation_id=?').bind(draft.intent.reservation_id).first();
  assert.equal(row.object_key,r2key);
  assert.equal(row.content_sha256,sha);
  assert.equal(row.byte_length,webp.length);
  const accounting=async()=>({
    quota:await db.prepare('SELECT lifetime_reserved_bytes,'+
      'month_uploads,lifetime_reservations '+
      'FROM jill_work_r2_quota_guard').first(),
    intents:(await db.prepare(
      'SELECT COUNT(*) AS n FROM jill_work_r2_object_intents'
    ).first()).n,
  });
  const initial=await accounting();
  assert.equal(initial.quota.month_uploads,1);
  assert.equal(initial.quota.lifetime_reserved_bytes,webp.length);
  assert.equal(initial.intents,1);

  // TEST-ONLY direct R2 PUT proves binding compatibility. This MUST NOT
  // be copied into production or treated as permission from the gate.
  // It uses only the name-pinned, remote:false synthetic test bucket.
  const put=await bucket.put(r2key,new Uint8Array(webp),{
    onlyIf:{etagDoesNotMatch:'*'},
    sha256:sha,
    httpMetadata:{contentType:'application/octet-stream',
      cacheControl:'private, no-store',
      contentDisposition:'attachment'},
    customMetadata:{
      work_stage:'quarantine_v1',
      sha256:sha,reference_mac:draft.intent.reference_mac,
    },
  });
  assert.ok(put,'Synthetic local R2 PUT must create a new object');
  const head=await bucket.head(r2key);
  assert.ok(head,'Local HEAD must find recorded key');
  assert.equal(head.key,r2key);
  assert.equal(head.size,webp.length);
  assert.equal(head.customMetadata?.sha256,sha);
  assert.equal(head.customMetadata?.reference_mac,
    draft.intent.reference_mac);
  assert.equal(head.customMetadata?.work_stage,'quarantine_v1');
  assert.equal(head.httpMetadata?.contentType,'application/octet-stream');
  assert.equal(head.httpMetadata?.cacheControl,'private, no-store');
  assert.equal(head.httpMetadata?.contentDisposition,'attachment');
  assert.equal(head.storageClass,'Standard');
  const obtained=await bucket.get(r2key);
  assert.ok(obtained);
  const stored=Buffer.from(await obtained.arrayBuffer());
  assert.equal(hash(stored),sha,'Local R2 bytes must equal Worker output');
  assert.deepEqual(stored,webp);

  // Attempt to overwrite the SAME key must fail its conditional,
  // preserve original local R2 bytes and original ownership record.
  const blocked=await bucket.put(r2key,new Uint8Array(webp),{
    onlyIf:{etagDoesNotMatch:'*'},
  });
  assert.equal(blocked,null);
  const afterOverwrite=await bucket.head(r2key);
  assert.equal(afterOverwrite.etag,head.etag);

  // Duplicate canonical slot must fail D1 batch. Its new generated key
  // must NEVER receive a provider object or increase quota counters.
  const duplicate=plan();
  assert.notEqual(duplicate.intent.object_key,r2key);
  await assert.rejects(()=>db.batch(duplicate.statements.map(s=>
    db.prepare(s.sql).bind(...s.params))));
  assert.equal(await bucket.head(duplicate.intent.object_key),null);
  assert.deepEqual(await accounting(),initial);

  // Persistent registry/intent remains QUARANTINED; no customer URL.
  const after=await db.prepare('SELECT state FROM '+
    'jill_work_r2_object_intents WHERE reservation_id=?')
    .bind(draft.intent.reservation_id).first();
  assert.equal(after.state,'reserved');
  const forbidden=await storageWorker.fetch(
    'http://localhost/__jill_phase19_private_artwork');
  assert.equal(forbidden.status,404);
  await forbidden.arrayBuffer();
  console.log('PASS LOCAL WORKERD Phase 19: real PNG -> WebP WASM, 23 schema statements in synthetic D1, atomic durable quota+intent, local conditional R2 PUT/HEAD/GET hash match, no overwrite or duplicate object, 404 public route; NO remote operations.');
}catch(error){
  console.error('STOP Phase 19 LOCAL WORKERD integration: '+
    String(error?.message||'unverified').slice(0,360));
  process.exitCode=1;
}finally{
  if(storageListening)await store.close();
  if(edgeListening)await edge.close();
}
