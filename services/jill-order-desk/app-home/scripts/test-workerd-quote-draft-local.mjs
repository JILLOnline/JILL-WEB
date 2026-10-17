// JILL HQ WORK — real LOCAL workerd D1 quote-draft batch lifecycle.
// Entirely synthetic verified request; no external network, real Shopify,
// Google QA, customer records, remote D1/R2, quote delivery or deployment.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestHarness} from 'wrangler';
import {planLocalWorkQuoteDraftSave as plan,
  inspectLocalWorkQuoteDraftReceipt as inspect}
  from '../../work-quote-draft-plan.mjs';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const SVC=resolve(ROOT,'services/jill-order-desk');
const CFG=resolve(APP,'workerd-phase19/wrangler.jsonc');
const P=resolve(SVC,'quote-proposals/0008_work_quote_drafts.sql');
const SHOP='jill-work.myshopify.com';
const ID='jill:11111111-2222-4333-8444-555555555555';
const OP1='jill:hq:quote:11111111-2222-4333-8444-555555555555';
const OP2='jill:hq:quote:11111111-2222-4333-8444-555555555556';
const OP3='jill:hq:quote:11111111-2222-4333-8444-555555555557';
const NOW=Date.parse('2026-10-17T13:00:00Z');
const cfg=JSON.parse(readFileSync(CFG,'utf8'));
const active=['0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql'];
assert.deepEqual(readdirSync(resolve(SVC,'migrations')).sort(),active);
assert.equal(cfg.name,'jill-work-phase19-local-media-only');
assert.equal(cfg.workers_dev,false);
assert.equal(cfg.d1_databases.length,1);
assert.equal(cfg.d1_databases[0].remote,false);
assert.equal(cfg.d1_databases[0].database_id,
  '00000000-0000-4000-8000-000000000019');
assert.equal(cfg.r2_buckets[0].remote,false);
assert.equal(cfg.services,undefined);
const sql=readFileSync(P,'utf8');
assert.match(sql,/INERT SOURCE-ONLY/);
const statements=sql.split(/\r?\n/).filter(x=>!x.trim().startsWith('--'))
  .join('\n').split(';').map(x=>x.trim()).filter(Boolean);
assert.equal(statements.length,2);
const detail={
  submission_id:ID,revision:3,
  items:[{item_id:'item-alpha',title:'Synthetic piñata',quantity:2},
    {item_id:'item-beta',title:'Synthetic favor',quantity:3}],
};
const record={submission_id:ID,revision:3,customer_status:'reviewing'};
const lines=[
  {id:'item-alpha',quantity:2,unitPrice:'25.99'},
  {id:'item-beta',quantity:3,unitPrice:'0.01'},
];
const fees={materials:'5',labor:'20',shipping:'12',other:'3',
  discount:'10',tax:'4.56'};
const input={shop:SHOP,submissionId:ID,detail,record,lines,fees,
  expectedDraftRevision:0,operationId:OP1,nowMs:NOW};
let tests=0;
const reject=x=>{
  assert.throws(()=>plan(x),/jill_work_quote_draft_not_authorized/);tests++;
};
for(const wrong of [
  null,undefined,{},[],
  {...input,shop:'jillonlinestore.myshopify.com'},
  {...input,submissionId:'jill:foreign'},
  {...input,operationId:'unsafe-op'},
  {...input,expectedDraftRevision:-1},
  {...input,expectedDraftRevision:100},
  {...input,nowMs:0},
  {...input,record:{...record,revision:2}},
  {...input,record:{...record,customer_status:'cancelled'}},
  {...input,record:{...record,customer_status:'completed'}},
  {...input,detail:{...detail,submission_id:'jill:another'}},
  {...input,detail:{...detail,revision:4}},
  {...input,lines:[lines[0]]},
  {...input,lines:[lines[0],{...lines[1],quantity:2}]},
  {...input,lines:[lines[0],{...lines[1],id:'forged'}]},
  {...input,lines:[lines[0],{...lines[1],unitPrice:''}]},
  {...input,lines:[lines[0],{...lines[1],unitPrice:'1e3'}]},
  {...input,fees:{...fees,discount:'99999.99'}},
  {...input,raw_customer_email:'untrusted@example.invalid'},
])reject(wrong);

const p1=plan(input);
const safe=x=>{
  for(const flag of [
    'remote_d1_migration_authorized','remote_d1_write_authorized',
    'authenticated_owner_verified','customer_access_granted',
    'quote_saved_to_real_work','payment_authorized',
    'shopify_draft_order_authorized','version_upload_authorized',
    'traffic_switch_authorized',
  ])assert.equal(x[flag],false,flag);
  assert.ok(Object.isFrozen(x));tests++;
};
safe(p1);
assert.equal(p1.next_draft_revision,1);
assert.equal(p1.quoted_total_cents,8657);
assert.equal(p1.statements.length,2);
assert.match(p1.source_sha256,/^[a-f0-9]{64}$/);
assert.match(p1.quote_sha256,/^[a-f0-9]{64}$/);
assert.equal(JSON.stringify(p1).includes('Synthetic piñata'),false);
assert.equal(JSON.stringify(p1).includes('untrusted@example.invalid'),false);
assert.equal(JSON.stringify(p1).includes('jillonlinestore.com'),false);
tests+=7;
const h=createTestHarness({root:APP,workers:[{configPath:CFG}]});
let listening=false;
try{
  await h.listen();listening=true;
  const worker=h.getWorker(cfg.name);
  const env=await worker.getEnv();
  assert.equal(Object.keys(env).filter(k=>/SECRET|TOKEN|SHOPIFY/.test(k)).length,0);
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  assert.ok(db?.batch);
  for(const statement of statements)await db.prepare(statement).run();
  const run=async p=>db.batch(p.statements.map(s=>
    db.prepare(s.sql).bind(...s.params)));
  const receipt=async p=>db.prepare(p.receipt_lookup.sql)
    .bind(...p.receipt_lookup.params).first();
  const row=()=>db.prepare('SELECT * FROM jill_work_quote_drafts '+
    'WHERE shop=? AND submission_id=?').bind(SHOP,ID).first();
  const count=()=>db.prepare(
    'SELECT COUNT(*) AS n FROM jill_work_quote_draft_operations').first();

  const first=await run(p1);
  assert.equal(first.length,2);
  assert.equal(first[0].results.length,1);
  assert.equal(first[0].results[0].draft_revision,1);
  assert.equal((await row()).draft_revision,1);
  assert.equal((await count()).n,1);
  assert.equal((await row()).total_cents,8657);
  assert.equal(JSON.parse((await row()).quote_json).items.length,2);
  const same=inspect({plan:p1,receipt:await receipt(p1)});
  assert.equal(same.outcome,'locally_recorded_only');
  safe(same);
  tests+=8;

  // Idempotent old-operation replay: no new version, no new receipt.
  const replay=await run(p1);
  assert.equal(replay[0].results.length,0);
  assert.equal((await row()).draft_revision,1);
  assert.equal((await count()).n,1);
  tests+=3;

  const p2=plan({...input,expectedDraftRevision:1,operationId:OP2,
    lines:[{...lines[0],unitPrice:'30.00'},lines[1]],nowMs:NOW+1000});
  safe(p2);
  const second=await run(p2);
  assert.equal(second[0].results[0].draft_revision,2);
  assert.equal((await row()).draft_revision,2);
  assert.equal((await count()).n,2);
  assert.equal((await row()).total_cents,9459);
  assert.equal(inspect({plan:p2,receipt:await receipt(p2)}).revision,2);
  tests+=5;

  // A stale operation must not modify the draft or create a receipt.
  const stale=plan({...input,expectedDraftRevision:1,
    operationId:OP3,nowMs:NOW+2000});
  const miss=await run(stale);
  assert.equal(miss[0].results.length,0);
  assert.equal((await row()).draft_revision,2);
  assert.equal((await receipt(stale)),null);
  assert.equal((await count()).n,2);
  assert.equal(inspect({plan:stale,receipt:null}).outcome,
    'not_confirmed_do_not_retry_automatically');
  tests+=5;

  // Reuse OP1 with a CURRENT revision: draft UPDATE succeeds first,
  // but duplicate receipt MUST abort and roll back the WHOLE batch.
  const recycled=plan({...input,expectedDraftRevision:2,
    operationId:OP1,nowMs:NOW+3000});
  await assert.rejects(()=>run(recycled));
  assert.equal((await row()).draft_revision,2);
  assert.equal((await row()).last_operation_id,OP2);
  assert.equal((await count()).n,2);
  tests+=4;

  // Source revision changed: a draft from a prior source cannot be
  // overwritten even with the correct expected draft revision.
  const newSource=plan({...input,detail:{...detail,revision:4},
    record:{...record,revision:4},operationId:OP3,
    expectedDraftRevision:2,nowMs:NOW+4000});
  const drift=await run(newSource);
  assert.equal(drift[0].results.length,0);
  assert.equal((await row()).draft_revision,2);
  assert.equal((await count()).n,2);
  tests+=3;

  // A forged receipt/mismatched quote digest cannot certify a save.
  assert.equal(inspect({plan:p2,receipt:{...await receipt(p2),
    quote_sha256:'f'.repeat(64)}}).outcome,
    'stop_draft_reconciliation_required');
  tests++;

  const stored=JSON.stringify(await row());
  for(const forbidden of ['@example','customer','Synthetic piñata',
    'reference_ids','raw_payload','shipping_address','Cloudinary'])
    assert.equal(stored.includes(forbidden),false);
  tests+=7;
  assert.equal((await worker.fetch('http://localhost/quote')).status,404);
  tests++;
  console.log('PASS WORK quote draft REAL LOCAL workerd D1: '+
    tests+' fixtures, versioned quote 1→2, idempotent replay, stale/source-drift denial, UNIQUE operation rollback, no customer PII; remote migration and deployment OFF.');
}catch{
  console.error('STOP WORK quote draft LOCAL D1 proof failed. No remote writes performed.');
  process.exitCode=1;
}finally{if(listening)await h.close();}
