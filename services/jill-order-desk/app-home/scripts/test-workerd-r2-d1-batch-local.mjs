// JILL WORK Phase 15: actual LOCAL workerd D1 binding batch semantics.
// Does not deploy, connect to remote D1, call R2, read customer files,
// use Shopify secrets, or create Cloudflare resources.
// Execute ONLY via npm test:workerd-r2-d1-batch in isolated App Home.
// This standalone test worker has an intentionally unrelated synthetic D1.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestHarness} from 'wrangler';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../../merchant-request-detail.mjs';
import {draftWorkMediaRegistryBinding}
  from '../../work-private-media-registry.mjs';
import {planWorkR2AtomicIntentBatch as createPlan,
  inspectWorkR2AtomicBatchReceipt as inspect}
  from '../../work-private-r2-d1-batch-plan.mjs';

const APP=fileURLToPath(new URL('../',import.meta.url));
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const SOURCE=resolve(ROOT,'services/jill-order-desk');
const cfgPath=resolve(APP,'workerd-phase15/wrangler.jsonc');
const cfg=JSON.parse(readFileSync(cfgPath,'utf8'));
const dummyId='00000000-0000-4000-8000-000000000015';
const testName='jill-work-phase15-local-only';
const fixtureDb='jill-work-phase15-local-synthetic';
const workDb='3f17c186-c794-4e00-8f20-017191373a19';
const EXPECTED_ACTIVE=[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
];
const PLANS=[
  '0004_work_private_media_registry.sql',
  '0005_work_r2_quota_guard.sql',
  '0006_work_r2_object_intents.sql',
];
function onlyLocal(){
  assert.equal(cfg.name,testName);
  assert.equal(cfg.workers_dev,false);
  assert.deepEqual(cfg.d1_databases,[{
    binding:'JILL_PHASE15_LOCAL_D1',
    database_name:fixtureDb,database_id:dummyId,remote:false,
  }]);
  assert.notEqual(dummyId,workDb);
  assert.equal(cfg.r2_buckets,undefined);
  assert.equal(cfg.services,undefined);
  assert.equal(cfg.routes,undefined);
  assert.equal(cfg.vars,undefined);
  assert.equal(cfg.env,undefined);
  assert.equal(cfg.main,'./worker.mjs');
  const active=readdirSync(resolve(SOURCE,'migrations')).sort();
  assert.deepEqual(active,EXPECTED_ACTIVE);
  for(const file of PLANS){
    const sql=readFileSync(resolve(SOURCE,'migration-plans',file),'utf8');
    assert.match(sql,/INERT PROPOSAL/);
  }
  for(const file of ['wrangler.jsonc','wrangler.canary.jsonc']){
    const prod=JSON.parse(readFileSync(resolve(APP,file),'utf8'));
    assert.equal(prod.r2_buckets,undefined);
    assert.equal(prod.d1_databases.length,1);
    assert.equal(prod.d1_databases[0].database_id,workDb);
    assert.notEqual(prod.name,testName);
  }
}
onlyLocal();
const shop='jill-work.myshopify.com';
const request='jill:11111111-2222-4333-8444-555555555555';
const registryKey='SYNTHETIC_LOCAL_WORKER_HMAC_KEY_NOT_REAL_0123456';
const nowMs=Date.parse('2026-10-16T12:00:00.000Z');
const aId='shopify-product:101',bId='shopify-product:202';
const refsA=Array.from({length:20},(_,i)=>'jill:phase15-a'+i);
const refsB=Array.from({length:20},(_,i)=>'jill:phase15-b'+i);
const input={
  version:1,operation:'custom_order.submit',submission_id:request,
  submitted_at:'2026-10-16T10:00:00Z',
  customer:{name:'Synthetic Only',email:'test@example.invalid'},
  planning:{fulfillment:'pickup',date_needed:'2026-11-01'},
  items:[
    {item_id:aId,product_id:aId,quantity:1,attributes:[],
      personalization_groups:[],reference_ids:refsA},
    {item_id:bId,product_id:bId,quantity:1,attributes:[],
      personalization_groups:[],reference_ids:refsB},
  ],
  request_attributes:[],reference_ids:['jill:phase15-request'],
};
const detail=project({rawPayload:JSON.stringify(input),
  submissionId:request,revision:2,ownerAuthorized:true});
const selectors=[
 ...refsA.map((_,index)=>({scope:'item',itemId:aId,index})),
 ...refsB.map((_,index)=>({scope:'item',itemId:bId,index})),
 {scope:'request',index:0},
];
const buildPlan=(selector,overrides={})=>createPlan({
  shop,detail,submissionId:request,selector,registryKey,
  contentSha256:'a'.repeat(64),byteLength:1024,nowMs,...overrides,
});
// D1Database.exec() can treat leading SQL-comment-only lines as empty
// statements. Unlike node:sqlite's DatabaseSync.exec(), D1's exec()
// is unsuitable for loading our commented multi-statement SQL fixtures.
// Parse only the six FIXED audited source files, then use one prepared
// statement per DDL/INSERT. Preserve CREATE TRIGGER BEGIN...END bodies,
// including their internal semicolons. This never touches remote D1.
const EXPECTED_STATEMENTS=Object.freeze({
  '0001_staff_authority.sql':5,
  '0002_shopify_sessions.sql':2,
  '0003_work_verified_inbox_index.sql':2,
  '0004_work_private_media_registry.sql':5,
  '0005_work_r2_quota_guard.sql':4,
  '0006_work_r2_object_intents.sql':5,
});
function localFixtureStatements(file,sql){
  assert.ok(Object.hasOwn(EXPECTED_STATEMENTS,file),
    'Unapproved SQL fixture file');
  const statements=[];
  let current=[],inTrigger=false;
  for(const line of sql.split(/\r?\n/)){
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('--'))continue;
    assert.equal(trimmed.includes('--'),false,
      'Fixture has unrecognized inline SQL comment');
    if(current.length===0){
      inTrigger=/^CREATE TRIGGER\b/i.test(trimmed);
    }
    current.push(trimmed);
    // Non-trigger statements end with semicolons. For a trigger, only
    // its outer END; closes the statement; inner RAISE(...); does not.
    const finished=inTrigger?/^END;$/i.test(trimmed):/;$/.test(trimmed);
    if(finished){
      statements.push(current.join(' '));
      current=[];
      inTrigger=false;
    }
  }
  assert.equal(current.length,0,'Incomplete local SQL fixture');
  assert.equal(statements.length,EXPECTED_STATEMENTS[file],
    'Unexpected SQL fixture statement count');
  return statements;
}
async function seedLocalOnlySchema(db){
  for(const file of [...EXPECTED_ACTIVE,...PLANS]){
    const folder=EXPECTED_ACTIVE.includes(file)?'migrations':'migration-plans';
    const sql=readFileSync(resolve(SOURCE,folder,file),'utf8');
    const statements=localFixtureStatements(file,sql);
    for(let i=0;i<statements.length;i++){
      try{
        await db.prepare(statements[i]).run();
      }catch(error){
        // Synthetic SQL only; never display customer records or secrets.
        throw Error('local schema fixture '+file+' statement '+(i+1)+
          ' failed: '+String(error?.message||'unverified').slice(0,240));
      }
    }
  }
}

const server=createTestHarness({
  root:APP,
  workers:[{configPath:cfgPath}],
});
try{
  await server.listen();
  const worker=server.getWorker(testName);
  const env=await worker.getEnv();
  assert.equal(Object.keys(env).includes('JILL_PHASE15_LOCAL_D1'),true);
  assert.equal(Object.keys(env).some(k=>/R2|SHOPIFY|SECRET|TOKEN/.test(k)),false);
  const db=env.JILL_PHASE15_LOCAL_D1;
  assert.equal(typeof db?.batch,'function');
  assert.equal(typeof db?.prepare,'function');
  assert.equal(typeof db?.exec,'function');

  await seedLocalOnlySchema(db);
  console.log('PASS local WORKERD synthetic D1: 23 prepared schema statements loaded (no remote migrations).');
  await db.prepare(
    'INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,owner_bound_at) '+
    'VALUES (?,?,?,?,?)'
  ).bind(shop,'WORK','phase15-synthetic','phase15-owner',
    '2026-10-16T11:00:00Z').run();
  const slotSql='INSERT INTO jill_work_private_media_registry '+
    '(shop,submission_id,scope,item_key,reference_index,reference_mac,'+
    'status,created_at_ms,updated_at_ms) VALUES (?,?,?,?,?,?,?,?,?)';
  for(const selector of selectors){
    const ref=draftWorkMediaRegistryBinding({
      detail,submissionId:request,selector,registryKey,
    });
    await db.prepare(slotSql).bind(
      shop,request,ref.scope,ref.item_id??'',ref.reference_index,
      ref.reference_mac,'pending_verification',nowMs,nowMs
    ).run();
  }
  const execution=async plan=>{
    assert.equal(plan.state,'source_only_d1_batch_plan');
    assert.equal(plan.execution_allowed,false);
    assert.equal(plan.statements.length,2);
    const statements=plan.statements.map(s=>
      db.prepare(s.sql).bind(...s.params));
    return db.batch(statements);
  };
  const counts=async()=>{
    const q=await db.prepare('SELECT lifetime_reserved_bytes,month_uploads,'+
      'month_class_a,month_class_b,lifetime_reservations '+
      'FROM jill_work_r2_quota_guard').first();
    const i=await db.prepare(
      'SELECT count(*) AS n FROM jill_work_r2_object_intents').first();
    return {...q,intents:i.n};
  };
  const p0=buildPlan(selectors[0]);
  assert.match(p0.statements[1].sql,/CASE WHEN changes\(\)=1 THEN \? ELSE NULL END/);
  const result=await execution(p0);
  const receipt=inspect({plan:p0,results:result});
  assert.equal(receipt.state,'server_only_intent_reserved_not_uploaded');
  assert.equal(receipt.upload_authorized,false);
  assert.equal(receipt.private_delivery,'disabled');
  assert.deepEqual(await counts(),{
    lifetime_reserved_bytes:1024,month_uploads:1,
    month_class_a:1,month_class_b:1,
    lifetime_reservations:1,intents:1,
  });
  const beforeDuplicate=await counts();
  await assert.rejects(()=>execution(buildPlan(selectors[0])),
    'Duplicate slot must trigger D1 batch rollback');
  assert.deepEqual(await counts(),beforeDuplicate);

  // A mismatched reference MAC must fail the second statement and undo
  // a successful first quota update in actual local Cloudflare D1.
  const p1=buildPlan(selectors[1]);
  const forged=p1.statements.map((s,i)=>i===1?
    db.prepare(s.sql).bind(...s.params.map((v,j)=>j===5?'f'.repeat(64):v)):
    db.prepare(s.sql).bind(...s.params));
  await assert.rejects(()=>db.batch(forged),
    'Forged MAC must trigger D1 batch rollback');
  assert.deepEqual(await counts(),beforeDuplicate);

  // Fill to exactly 40 different canonical slots in this UTC month.
  for(const selector of selectors.slice(1,40)){
    const p=buildPlan(selector);
    const r=inspect({plan:p,results:await execution(p)});
    assert.equal(r.upload_authorized,false);
  }
  assert.deepEqual(await counts(),{
    lifetime_reserved_bytes:40*1024,month_uploads:40,
    month_class_a:40,month_class_b:40,
    lifetime_reservations:40,intents:40,
  });
  const beforeExhaustion=await counts();
  // The 41st canonical reference is valid. SQL UPDATE affects zero rows.
  // changes() guard must abort the second INSERT and leave no 41st intent.
  await assert.rejects(()=>execution(buildPlan(selectors[40])),
    'Exhausted quota must roll back in actual local D1 batch');
  assert.deepEqual(await counts(),beforeExhaustion);
  const orphan=await db.prepare(
    "SELECT COUNT(*) AS n FROM jill_work_r2_object_intents WHERE scope='request'"
  ).first();
  assert.equal(orphan.n,0);

  // The synthetic Worker has no customer/merchant preview route.
  const res=await worker.fetch('http://localhost/__phase15-media',{
    method:'GET',redirect:'manual',
  });
  assert.equal(res.status,404);
  await res.arrayBuffer();
  console.log('PASS local WORKERD D1 batch: 2-statement real local D1 batch, successful reservation, duplicate and forged-MAC rollback, 40/41 zero-row quota denial without orphan. Synthetic D1 only; NO remote writes.');
} catch(error){
  // No actual customer data or credentials are present in this harness.
  console.error('STOP local WORKERD Phase 15 batch: '+String(
    error?.message||'unverified').slice(0,300));
  process.exitCode=1;
} finally {
  await server.close();
}
