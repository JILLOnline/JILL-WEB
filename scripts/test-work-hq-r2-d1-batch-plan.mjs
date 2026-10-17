// WORK PHASE 14 — in-memory SQLite emulates one D1 batch() transaction.
// NO real D1, Cloudflare, R2, accounts, customer data, HTTP or deployment.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';
import {draftWorkMediaRegistryBinding}
  from '../services/jill-order-desk/work-private-media-registry.mjs';
import {planWorkR2AtomicIntentBatch as planBatch,
  inspectWorkR2AtomicBatchReceipt as inspect}
  from '../services/jill-order-desk/work-private-r2-d1-batch-plan.mjs';

const ROOT='services/jill-order-desk/';
const active=readdirSync(ROOT+'migrations').sort();
assert.deepEqual(active,['0001_staff_authority.sql',
  '0002_shopify_sessions.sql','0003_work_verified_inbox_index.sql']);
const proposals=[
  '0004_work_private_media_registry.sql',
  '0005_work_r2_quota_guard.sql',
  '0006_work_r2_object_intents.sql',
];
const sql=proposals.map(file=>readFileSync(
  ROOT+'migration-plans/'+file,'utf8'));
for(const statement of sql)assert.match(statement,/INERT PROPOSAL/);
const work=JSON.parse(readFileSync(
  ROOT+'app-home/wrangler.jsonc','utf8'));
const canary=JSON.parse(readFileSync(
  ROOT+'app-home/wrangler.canary.jsonc','utf8'));
assert.equal(work.r2_buckets,undefined);
assert.equal(canary.r2_buckets,undefined);

const shop='jill-work.myshopify.com';
const id='jill:11111111-2222-4333-8444-555555555555';
const key='SYNTHETIC_32_BYTE_HMAC_TEST_KEY_ONLY_DO_NOT_USE_LIVE';
const nowMs=Date.parse('2026-10-16T12:00:00.000Z');
const itemA='shopify-product:101';
const itemB='shopify-product:202';
const refsA=Array.from({length:20},(_,i)=>'jill:a'+i);
const refsB=Array.from({length:20},(_,i)=>'jill:b'+i);
const payload={
  version:1,operation:'custom_order.submit',submission_id:id,
  submitted_at:'2026-10-16T10:00:00Z',
  customer:{name:'Synthetic',email:'no-contact@example.invalid'},
  planning:{fulfillment:'pickup'},
  items:[
    {item_id:itemA,product_id:itemA,quantity:1,
      attributes:[],personalization_groups:[],reference_ids:refsA},
    {item_id:itemB,product_id:itemB,quantity:1,
      attributes:[],personalization_groups:[],reference_ids:refsB},
  ],request_attributes:[],reference_ids:['jill:request-extra'],
};
const detail=project({rawPayload:JSON.stringify(payload),
  submissionId:id,ownerAuthorized:true,revision:2});
const selectors=[
  ...refsA.map((_,index)=>({scope:'item',itemId:itemA,index})),
  ...refsB.map((_,index)=>({scope:'item',itemId:itemB,index})),
  {scope:'request',index:0},
];
const makePlan=(selector,overrides={})=>planBatch({
  shop,detail,submissionId:id,selector,registryKey:key,
  contentSha256:'a'.repeat(64),byteLength:1024,nowMs,
  ...overrides,
});
const db=new DatabaseSync(':memory:');
try{
  db.exec('PRAGMA foreign_keys=ON;');
  for(const f of active)db.exec(readFileSync(ROOT+'migrations/'+f,'utf8'));
  for(const proposal of sql)db.exec(proposal);
  db.prepare('INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,owner_bound_at) '+
    'VALUES (?,?,?,?,?)').run(shop,'WORK','synthetic-app','owner',
    '2026-10-16T11:00:00Z');
  const bind=db.prepare('INSERT INTO jill_work_private_media_registry '+
    '(shop,submission_id,scope,item_key,reference_index,reference_mac,'+
    'status,created_at_ms,updated_at_ms) VALUES (?,?,?,?,?,?,?,?,?)');
  for(const selector of selectors){
    const record=draftWorkMediaRegistryBinding({
      detail,submissionId:id,selector,registryKey:key,
    });
    bind.run(shop,id,record.scope,record.item_id??'',
      record.reference_index,record.reference_mac,
      'pending_verification',nowMs,nowMs);
  }

  // D1-like binding facade: a single batch, sequential statements, one
  // rollback on any statement error. NO real D1 Worker is involved.
  const facade={
    prepare(sqlText){
      return {bind(...params){return Object.freeze({sqlText,params});}};
    },
    async batch(statements){
      if(!Array.isArray(statements)||statements.length!==2)
        throw Error('only_two_prepared_statements');
      db.exec('BEGIN IMMEDIATE');
      try{
        const results=statements.map(statement=>{
          const rows=db.prepare(statement.sqlText).all(...statement.params);
          return {success:true,results:rows.map(row=>({...row}))};
        });
        db.exec('COMMIT');
        return results;
      }catch(error){
        db.exec('ROLLBACK');
        throw Error('local_batch_rolled_back',{cause:error});
      }
    },
  };
  const execute=async plan=>{
    const statements=plan.statements.map(s=>
      facade.prepare(s.sql).bind(...s.params));
    return facade.batch(statements);
  };
  const counters=()=>({...db.prepare(
    'SELECT * FROM jill_work_r2_quota_guard').get()});
  const objects=()=>db.prepare(
    'SELECT COUNT(*) AS n FROM jill_work_r2_object_intents').get().n;
  const original=makePlan(selectors[0]);
  assert.equal(original.state,'source_only_d1_batch_plan');
  assert.equal(original.execution_allowed,false);
  assert.equal(original.statements.length,2);
  assert.match(original.statements[1].sql,/CASE WHEN changes\(\)=1 THEN \? ELSE NULL END/);
  assert.match(original.statements[0].sql,/UPDATE jill_work_r2_quota_guard/);
  assert.ok(Object.isFrozen(original));
  assert.ok(Object.isFrozen(original.statements));
  assert.ok(Object.isFrozen(original.statements[0].params));
  const success=await execute(original);
  const receipt=inspect({plan:original,results:success});
  assert.equal(receipt.state,'server_only_intent_reserved_not_uploaded');
  assert.equal(receipt.upload_authorized,false);
  assert.equal(receipt.private_delivery,'disabled');
  assert.ok(Object.isFrozen(receipt));
  assert.doesNotMatch(JSON.stringify(receipt),
    /work\/quarantine|reference_mac|email|https?:|reservation_id/);
  assert.equal(objects(),1);
  assert.equal(counters().month_uploads,1);
  assert.equal(counters().lifetime_reserved_bytes,1024);

  const afterFirst=counters();
  await assert.rejects(()=>execute(makePlan(selectors[0])),
    /local_batch_rolled_back/);
  assert.deepEqual(counters(),afterFirst,
    'duplicate intent must roll back successfully reserved quota');
  assert.equal(objects(),1);

  // Forged reference MAC: reservation succeeds but insert must fail,
  // leaving exactly the same quota, never a mismatched owner.
  const next=makePlan(selectors[1]);
  const forgedStatements=next.statements.map((s,i)=>i===1?
    {...s,params:s.params.map((x,k)=>k===5?'f'.repeat(64):x)}:s);
  await assert.rejects(()=>facade.batch(
    forgedStatements.map(s=>facade.prepare(s.sql).bind(...s.params))),
    /local_batch_rolled_back/);
  assert.deepEqual(counters(),afterFirst);
  assert.equal(objects(),1);

  // Fill quota to exactly 40 different canonical reference slots.
  for(const selector of selectors.slice(1,40)){
    const p=makePlan(selector);
    assert.equal(inspect({plan:p,results:await execute(p)}).upload_authorized,false);
  }
  assert.equal(counters().month_uploads,40);
  assert.equal(counters().month_class_a,40);
  assert.equal(counters().month_class_b,40);
  assert.equal(objects(),40);

  // The 41st slot is valid and unclaimed. The quota UPDATE returns no
  // row; changes()=0 forces NOT NULL violation on intent insert, and
  // the entire transaction rolls back rather than creating an orphan.
  const exhaustedBefore=counters();
  await assert.rejects(()=>execute(makePlan(selectors[40])),
    /local_batch_rolled_back/);
  assert.deepEqual(counters(),exhaustedBefore);
  assert.equal(objects(),40);
  assert.equal(db.prepare(
    "SELECT COUNT(*) n FROM jill_work_r2_object_intents WHERE scope='request'"
  ).get().n,0);

  // D1 response is not authority when its content is forged/partial.
  for(const result of [
    [],[{success:true,results:[success[0].results[0]]}],
    [{success:true,results:[]},success[1]],
    [success[0],{...success[1],success:false}],
    [success[0],{success:true,results:[{
      ...success[1].results[0],object_key:'work/quarantine/v1/forged',
    }]}],
  ])assert.throws(()=>inspect({plan:original,results:result}),
    /work_r2_atomic_batch_not_authorized/);
  assert.throws(()=>makePlan(selectors[0],{shop:'jillonlinestore.myshopify.com'}));
  assert.throws(()=>makePlan(selectors[0],{byteLength:0}));
  assert.throws(()=>makePlan(selectors[0],{contentSha256:'not-a-hash'}));

  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_shopify_sessions').get().n,0);
  assert.equal(db.prepare('SELECT generation FROM jill_work_verified_inbox_index').get().generation,0);
  console.log('PASS WORK D1 batch PLAN offline: two prepared statements one rollback, zero-row quota denial cannot leave intent, duplicate/forged MAC rollback, 40/41 quota, receipt forgery rejected; no remote operations.');
}finally{db.close();}
