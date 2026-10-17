// WORK Phase 26 — REAL local workerd D1, source-only synthetic intake.
// Never deploy, call Shopify/Google, access actual customer records,
// mutate remote D1, create R2 objects, or claim receipt was accepted.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestHarness} from 'wrangler';
import {
  planLocalWorkIntakeReserve as reserve,
  inspectLocalWorkIntakeExisting as inspect,
  planLocalWorkIntakeClaimFirstDispatch as claim,
  planLocalWorkIntakeUncertain as uncertain,
  planLocalWorkIntakeSyntheticConfirmation as confirm,
} from '../../work-intake-ledger-plan.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const SRC=resolve(ROOT,'services/jill-order-desk');
const CFG=resolve(APP,'workerd-phase19/wrangler.jsonc');
const cfg=JSON.parse(readFileSync(CFG,'utf8'));
const SQLFILE=resolve(SRC,'intake-ledger-proposals/0007_work_intake_ledger.sql');
const expectedName='jill-work-phase19-local-media-only';
const SHOP='jill-work.myshopify.com';
const ID='jill:11111111-2222-4333-8444-555555555555';
const OWNER='gid://shopify/Customer/12345678';
const MAC='SYNTHETIC_LOCAL_PHASE26_INTAKE_SECRET_0123456789ABCDEF';
const NOW=Date.parse('2026-10-16T15:00:00Z');
const active=['0001_staff_authority.sql',
  '0002_shopify_sessions.sql','0003_work_verified_inbox_index.sql'];
assert.equal(cfg.name,expectedName);
assert.equal(cfg.workers_dev,false);
assert.equal(cfg.d1_databases[0].database_id,
  '00000000-0000-4000-8000-000000000019');
assert.equal(cfg.d1_databases[0].remote,false);
assert.equal(cfg.r2_buckets[0].remote,false);
assert.equal(cfg.r2_buckets[0].bucket_name,
  'jill-phase19-local-synthetic-artwork');
assert.deepEqual(readdirSync(resolve(SRC,'migrations')).sort(),active);
for(const file of ['wrangler.jsonc','wrangler.canary.jsonc']){
  const c=JSON.parse(readFileSync(resolve(APP,file),'utf8'));
  assert.equal(c.d1_databases[0].database_id,
    '3f17c186-c794-4e00-8f20-017191373a19');
  assert.equal(c.r2_buckets,undefined);
  assert.equal(c.vars.JILL_WORK_INTAKE_LEDGER_ENABLED,undefined);
}
const script=readFileSync(resolve(SRC,'work-intake-ledger-plan.mjs'),'utf8');
assert.doesNotMatch(script,/\bfetch\(|\.put\(|db\.prepare\(|db\.batch\(|wrangler deploy/);
const worker=readFileSync(resolve(ROOT,
  'services/custom-order-cloudflare/handler.mjs'),'utf8');
assert.doesNotMatch(worker,/work-intake-ledger-plan|0007_work_intake_ledger/);
const route=readFileSync(resolve(ROOT,
  'backend/custom-order-gateway.mjs'),'utf8');
assert.match(route,/confirmation\?\.operation!=='custom_order\.receipt\.result'/);
assert.match(route,/confirmation\.status!=='received'/);
const proposal=readFileSync(SQLFILE,'utf8');
assert.match(proposal,/INERT SOURCE-ONLY/);
function statements(text){
  let buffer=[],trigger=false;const out=[];
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('--'))continue;
    if(buffer.length===0)trigger=/^CREATE TRIGGER\b/i.test(line);
    buffer.push(line);
    if(trigger?/^END;$/i.test(line):/;\s*$/.test(line)){
      out.push(buffer.join(' '));buffer=[];trigger=false;
    }
  }
  assert.equal(buffer.length,0);
  assert.equal(out.length,4);
  return out;
}
function form(email='one@example.invalid'){
  const envelope={
    version:1,operation:'custom_order.submit',submission_id:ID,
    submitted_at:'2026-10-16T15:00:00.000Z',
    customer:{email},
    items:[{product_id:'shopify-product:101',quantity:1}],
  };
  return new URLSearchParams({
    source:'JILL custom order',
    submission_id:ID,submitted_at:envelope.submitted_at,
    raw_payload:JSON.stringify(envelope),email,
  }).toString();
}
const input={shop:SHOP,submissionId:ID,formBody:form(),
  ownerGid:OWNER,macKey:MAC,nowMs:NOW};
const safety=p=>{
  for(const field of [
    'production_ready','independently_authenticated',
    'customer_ack_authorized','retry_dispatch_authorized',
    'backend_receipt_confirmed','paid_order_confirmed',
    'queue_delivery_authorized','remote_migration_authorized',
    'deployment_authorized','mutation_executed',
  ])assert.equal(p[field],false,field);
  assert.equal(Object.isFrozen(p),true);
};
const reject=fn=>assert.throws(fn,/jill_work_intake_ledger_not_authorized/);
for(const x of [null,undefined,{},'junk',[],
  {...input,shop:'jillonlinestore.myshopify.com'},
  {...input,ownerGid:'12345678'},
  {...input,ownerGid:'gid://shopify/Customer/0'},
  {...input,formBody:'jill_order_owner_gid=steal'},
  {...input,formBody:form().replace('one%40','two%40')},
  {...input,macKey:'short'},
  {...input,nowMs:-1},
  {...input,raw_customer_email:'private@example.invalid'},
])reject(()=>reserve(x));
const make=reserve(input);
safety(make);
assert.equal(make.kind,'local_intake_reservation_plan');
assert.equal(make.params.length,6);
assert.equal(make.params[0],SHOP);
assert.equal(make.params[1],ID);
assert.equal(make.params[2].length,64);
assert.equal(make.params[3].length,64);
assert.equal(JSON.stringify(make).includes('one@example.invalid'),false);
assert.equal(JSON.stringify(make).includes(OWNER),false);
const h=createTestHarness({root:APP,workers:[{configPath:CFG}]});
let up=false;
try{
  await h.listen();up=true;
  const work=h.getWorker(expectedName);
  const env=await work.getEnv();
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  const r2=env.JILL_PHASE19_SYNTHETIC_R2;
  assert.equal(typeof r2.put,'function');
  for(const statement of statements(proposal))
    await db.prepare(statement).run();
  const apply=async p=>{
    const out=await db.prepare(p.sql).bind(...p.params).all();
    assert.equal(out.success,true);
    return out.results;
  };
  const get=async p=>db.prepare(p.lookupSql)
    .bind(...p.lookupParams).first();
  // The first durable row is allowed; it still never acknowledges
  // the customer and has not reached Google's signed acceptance.
  const first=await apply(make);
  assert.equal(first.length,1);
  assert.equal(first[0].state,'reserved');
  let row=await get(make);
  assert.equal(inspect({plan:make,row}).outcome,
    'unconfirmed_or_ambiguous_no_ack');
  const second=await apply(make);
  assert.equal(second.length,0,'duplicate unique key cannot insert');
  assert.equal(inspect({plan:make,row}).customer_ack_authorized,false);
  const changed=reserve({...input,formBody:form('two@example.invalid')});
  assert.equal((await apply(changed)).length,0);
  const otherOwner=reserve({...input,ownerGid:'gid://shopify/Customer/98765'});
  assert.equal((await apply(otherOwner)).length,0);
  for(const bad of [changed,otherOwner])
    assert.equal(inspect({plan:bad,row}).kind,'payload_or_owner_conflict');
  const details=(p,time=NOW+1000)=>({
    shop:SHOP,submissionId:ID,payloadMac:p.identity_mac,
    ownerMac:p.owner_mac,priorUpdatedAtMs:time-1000,nowMs:time,
  });
  const start=claim(details(make,NOW+1000));
  safety(start);
  let moved=await apply(start);
  assert.equal(moved.length,1);
  assert.equal(moved[0].state,'forwarding');
  assert.equal(moved[0].dispatch_attempts,1);
  assert.equal((await apply(start)).length,0,
    'second dispatch attempt cannot acquire reserved state');
  // Uncertain Google outcome: no blind second upstream request.
  const uncertainPlan=uncertain(details(make,NOW+2000));
  safety(uncertainPlan);
  moved=await apply(uncertainPlan);
  assert.equal(moved.length,1);
  assert.equal(moved[0].state,'ambiguous');
  assert.equal((await apply(uncertainPlan)).length,0);
  assert.equal((await apply(claim(details(make,NOW+3000)))).length,0);
  row=await get(make);
  assert.equal(inspect({plan:make,row}).outcome,
    'unconfirmed_or_ambiguous_no_ack');
  // A delayed receipt may be RECORDED in the synthetic model; it
  // cannot create an HTTP success because it is not a verified Google
  // signature. A real adapter must independently verify it.
  reject(()=>confirm({input:details(make,NOW+3000),
    from:'ambiguous',evidenceMarker:'forged_client_header'}));
  const proof=confirm({input:details(make,NOW+3000),
    from:'ambiguous',evidenceMarker:'synthetic_local_only_google_receipt'});
  safety(proof);
  moved=await apply(proof);
  assert.equal(moved.length,1);
  assert.equal(moved[0].state,'confirmed');
  assert.equal((await apply(proof)).length,0);
  row=await get(make);
  assert.equal(inspect({plan:make,row}).outcome,
    'independent_google_receipt_required');
  assert.equal(inspect({plan:make,row}).customer_ack_authorized,false);
  for(const statement of [
    "UPDATE jill_work_intake_ledger SET state='forwarding',"+
    "updated_at_ms="+(NOW+4000)+" WHERE shop='"+SHOP+"'",
    "DELETE FROM jill_work_intake_ledger",
    "UPDATE jill_work_intake_ledger SET payload_mac='"+
      'f'.repeat(64)+"' WHERE shop='"+SHOP+"'",
  ])await assert.rejects(()=>db.prepare(statement).run());
  const total=await db.prepare(
    'SELECT count(*) AS n FROM jill_work_intake_ledger').first();
  assert.equal(total.n,1);
  const rawRow=await db.prepare(
    'SELECT * FROM jill_work_intake_ledger').first();
  const rawText=JSON.stringify(rawRow);
  assert.equal(rawText.includes('one@example.invalid'),false);
  assert.equal(rawText.includes(OWNER),false);
  assert.equal(rawText.includes('raw_payload'),false);
  assert.equal(rawText.includes('shopify-product:101'),false);
  assert.equal((await work.fetch('http://localhost/__intake_ledger')).status,404);
  console.log('PASS WORK Phase 26 LOCAL intake ledger: 1 immutable first reservation, duplicate/changed payload/cross-owner denied, only 1 dispatch, ambiguous->synthetic confirmed CAS, no PII or unsafe customer receipt; local D1 only.');
}catch(error){
  console.error('STOP WORK Phase 26 LOCAL intake ledger: '+
    String(error?.message||'unverified').slice(0,360));
  process.exitCode=1;
}finally{if(up)await h.close();}
