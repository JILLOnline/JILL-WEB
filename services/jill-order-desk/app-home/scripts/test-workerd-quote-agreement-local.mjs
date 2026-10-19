import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createTestHarness} from 'wrangler';
import {freezeWorkQuote,publishWorkQuote,acceptWorkQuote,advanceWorkCommerce,
  agreementHash,reconcileWorkOrder} from '../../work-quote-agreement.mjs';

const APP=fileURLToPath(new URL('../',import.meta.url));
const cfg=APP+'workerd-phase19/wrangler.jsonc';
const parsed=JSON.parse(readFileSync(cfg,'utf8'));
assert(parsed.d1_databases.every(x=>x.remote===false));
const harness=createTestHarness({root:APP,workers:[{configPath:cfg}]});
const SHOP='jill-work.myshopify.com',ID='jill:local-agreement-111',GID='gid://shopify/Customer/111';
const now=Date.now(),source={customer_gid:GID,revision:3,sha256:'a'.repeat(64)};
const calculation={shop:SHOP,customer_gid:GID,currency:'USD',
  input_sha256:'b'.repeat(64),address_sha256:'c'.repeat(64),calculated_at_ms:now,
  lines:[{variant_id:'gid://shopify/ProductVariant/111',quantity:2,subtotal_cents:1000,options:'Blue, purple'}],
  fulfillment:'pickup',shipping_cents:0,tax_cents:0,discount_cents:100,total_cents:900,
  reward:{reservation_id:'jill:reward:local-111',code:'LOCAL_REWARD',discount_cents:100,policy:'universal_v1'}};
const freeze=(revision=1,overrides={})=>freezeWorkQuote({submissionId:ID,revision,source,
  calculation,expiresAtMs:now+3600000,nowMs:now,staffId:'123',...overrides});
try{
  await harness.listen();
  const {JILL_PHASE19_SYNTHETIC_D1:db}=await harness.getWorker(parsed.name).getEnv();
  const sql=readFileSync(fileURLToPath(new URL('../../quote-proposals/0009_work_quote_agreements.sql',import.meta.url)),'utf8');
  for(const statement of sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n').split(';').filter(s=>s.trim()))
    await db.prepare(statement).run();
  const q1=freeze();const pub1=randomUUID();
  await publishWorkQuote({db,frozen:q1,operationId:pub1,expectedRevision:0});
  await publishWorkQuote({db,frozen:q1,operationId:pub1,expectedRevision:0});
  assert.throws(()=>freeze(1,{calculation:{...calculation,total_cents:1}}),/calculation_total/);
  assert.throws(()=>freeze(1,{calculation:{...calculation,calculated_at_ms:now-31000}}),/calculation_unverified/);
  const q2=freeze(2,{calculation:{...calculation,address_sha256:'d'.repeat(64)}});
  await publishWorkQuote({db,frozen:q2,operationId:randomUUID(),expectedRevision:1});
  const accept={db,submissionId:ID,operationId:randomUUID(),revision:2,hash:q2.hash,
    identity:{shop:SHOP,customerGid:GID},readOwnedSource:async()=>source,nowMs:now};
  await assert.rejects(()=>acceptWorkQuote({...accept,revision:1,hash:q1.hash}),/stale_or_expired/);
  await assert.rejects(()=>acceptWorkQuote({...accept,nowMs:now+3600001}),/stale_or_expired/);
  await assert.rejects(()=>acceptWorkQuote({...accept,identity:{shop:SHOP,customerGid:'gid://shopify/Customer/222'}}),/owner_unverified/);
  await assert.rejects(()=>acceptWorkQuote({...accept,readOwnedSource:async()=>({...source,revision:4})}),/stale_or_expired/);
  const broken={prepare:db.prepare.bind(db),batch:statements=>db.batch([
    ...statements,db.prepare('INSERT INTO nonexistent_atomic_failure VALUES (1)')])};
  await assert.rejects(()=>acceptWorkQuote({...accept,db:broken}));
  assert.equal((await db.prepare('SELECT count(*) AS n FROM jill_work_quote_acceptances').first()).n,0,
    'Real D1 batch rollback must undo acceptance if intent commit fails');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM jill_work_commerce_intents').first()).n,0);
  const receipt=await acceptWorkQuote(accept);
  assert.equal(receipt.duplicate,false);
  assert.equal((await acceptWorkQuote({...accept,operationId:randomUUID()})).operation_id,receipt.operation_id);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM jill_work_commerce_intents').first()).n,1);
  await assert.rejects(()=>publishWorkQuote({db,frozen:freeze(3),operationId:randomUUID(),expectedRevision:2}),/revision_changed/);
  let creates=0,eventConfirmed=false,found=false;
  const args={db,submissionId:ID,nowMs:now,authorizeStaff:async()=>true,
    confirmPublicAcceptance:async()=>({confirmed:eventConfirmed,operation_id:receipt.operation_id,
      submission_id:ID,quote_hash:q2.hash}),
    createDraft:async()=>{creates++;throw Error('Timed out AFTER Shopify created draft');},
    findDrafts:async()=>found?[{id:'gid://shopify/DraftOrder/111'}]:[],
    readDraft:async()=>({customer_gid:GID,quote_hash:q2.hash,submission_id:ID,
      operation_id:receipt.operation_id,input_sha256:calculation.input_sha256,
      address_sha256:q2.terms.address_sha256,currency:'USD',totals:q2.terms.totals,
      lines:q2.terms.lines,reward:q2.terms.reward})};
  assert.equal((await advanceWorkCommerce(args)).state,'accepted_pending_event');
  assert.equal(creates,0,'No Shopify create before canonical public acceptance');
  eventConfirmed=true;
  assert.equal((await advanceWorkCommerce(args)).state,'needs_reconciliation');
  assert.equal(creates,1);
  for(let n=0;n<3;n++)assert.equal((await advanceWorkCommerce(args)).state,'needs_reconciliation');
  assert.equal(creates,1,'An empty search never authorizes another create');
  found=true;
  assert.equal((await advanceWorkCommerce(args)).state,'draft_linked');
  assert.equal((await advanceWorkCommerce(args)).draft_gid,'gid://shopify/DraftOrder/111');
  assert.equal(creates,1);
  const linked=await db.prepare('SELECT * FROM jill_work_commerce_links').first();
  assert.equal(linked.order_gid,null,'Approval/draft never mark paid or complete order');
  const readDraft=async()=>({order_gid:'gid://shopify/Order/111'});
  const order={customer_gid:GID,submission_id:ID,quote_hash:q2.hash,
    operation_id:receipt.operation_id,financial_status:'PAID',fulfillment_status:'UNFULFILLED'};
  assert.equal((await reconcileWorkOrder({db,submissionId:ID,readDraft,readOrder:async()=>({...order,customer_gid:'gid://shopify/Customer/222'})})).state,'quarantined');
  assert.equal((await db.prepare('SELECT order_gid FROM jill_work_commerce_links').first()).order_gid,null);
  // Quarantine cannot be cleared by another webhook/read; operator review is mandatory.
  assert.equal((await reconcileWorkOrder({db,submissionId:ID,readDraft,readOrder:async()=>order})).state,'quarantined');
  assert.equal((await advanceWorkCommerce(args)).state,'quarantined');
  console.log('PASS real LOCAL D1 immutable quote revisions, stale/expired/owner denial, atomic rollback, one acceptance/intent, lost-create reconciliation, one draft, and order customer mismatch quarantine.');
}finally{await harness.close();}
