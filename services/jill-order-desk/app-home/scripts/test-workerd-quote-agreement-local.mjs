import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createTestHarness} from 'wrangler';
import {freezeWorkQuote,publishWorkQuote,acceptWorkQuote,advanceWorkCommerce,
  agreementHash,reconcileWorkOrder,readOwnedWorkQuote,normalizeWorkQuoteAddress} from '../../work-quote-agreement.mjs';

const APP=fileURLToPath(new URL('../',import.meta.url));
const cfg=APP+'workerd-phase19/wrangler.jsonc';
const parsed=JSON.parse(readFileSync(cfg,'utf8'));
assert(parsed.d1_databases.every(x=>x.remote===false));
const harness=createTestHarness({root:APP,workers:[{configPath:cfg}]});
const SHOP='jill-work.myshopify.com',ID='jill:local-agreement-111',GID='gid://shopify/Customer/111';
const now=Date.now(),source={customer_gid:GID,revision:3,sha256:'a'.repeat(64)};
const address=normalizeWorkQuoteAddress({address1:'1 Synthetic Test Way',city:'Jacksonville',provinceCode:'FL',zip:'32218',countryCode:'US'});
const calculation={shop:SHOP,customer_gid:GID,currency:'USD',
  input_sha256:'b'.repeat(64),address_sha256:agreementHash(address),address,shipping_title:'Reviewed pickup',calculated_at_ms:now,
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
  const read={db,submissionId:ID,identity:{shop:SHOP,customerGid:GID},readOwnedSource:async()=>source,nowMs:now};
  assert.deepEqual(await readOwnedWorkQuote(read),{state:'no_quote',quote:null});
  await publishWorkQuote({db,frozen:q1,operationId:pub1,expectedRevision:0});
  await publishWorkQuote({db,frozen:q1,operationId:pub1,expectedRevision:0});
  assert.throws(()=>freeze(1,{calculation:{...calculation,total_cents:1}}),/calculation_total/);
  assert.throws(()=>freeze(1,{calculation:{...calculation,calculated_at_ms:now-31000}}),/calculation_unverified/);
  assert.throws(()=>freeze(1,{calculation:{...calculation,address:{...address,city:'Changed'}}}),/delivery_unverified/);
  const changedAddress={...address,address2:'Suite 2'};
  const q2=freeze(2,{calculation:{...calculation,address:changedAddress,address_sha256:agreementHash(changedAddress)}});
  await publishWorkQuote({db,frozen:q2,operationId:randomUUID(),expectedRevision:1});
  const displayed=await readOwnedWorkQuote(read);
  assert.equal(displayed.state,'available');assert.equal(displayed.quote.revision,2);
  assert.deepEqual(displayed.quote.address,changedAddress);assert.equal(displayed.quote.shipping_title,'Reviewed pickup');
  assert.equal(displayed.quote.hash,q2.hash);assert.notEqual(q2.hash,q1.hash);
  assert.equal((await readOwnedWorkQuote({...read,nowMs:now+3600001})).state,'expired');
  assert.deepEqual(await readOwnedWorkQuote({...read,readOwnedSource:async()=>({...source,revision:4})}),{state:'source_changed',quote:null});
  const neverRead={prepare:()=>{throw Error('D1 must not run before ownership');}};
  await assert.rejects(()=>readOwnedWorkQuote({...read,db:neverRead,identity:{shop:SHOP,customerGid:'gid://shopify/Customer/222'}}),/owner_unverified/);
  assert.deepEqual(await readOwnedWorkQuote({...read,identity:{shop:SHOP,customerGid:'gid://shopify/Customer/222'},
    readOwnedSource:async()=>({...source,customer_gid:'gid://shopify/Customer/222'})}),{state:'no_quote',quote:null});
  await assert.rejects(()=>readOwnedWorkQuote({...read,db:neverRead,readOwnedSource:async()=>{throw Error('canonical read outage');}}),/canonical read outage/);
  await assert.rejects(()=>readOwnedWorkQuote({...read,db:{prepare:()=>{throw Error('D1 read outage');}}}),/D1 read outage/);
  await assert.rejects(()=>readOwnedWorkQuote({...read,identity:{shop:'other.myshopify.com',customerGid:GID}}),/unauthorized/);
  assert.doesNotMatch(JSON.stringify(displayed),/staff_id|source_sha256|source_revision|customer_gid|reservation_id|LOCAL_REWARD|raw_payload|internal/);
  await db.prepare("UPDATE jill_work_quote_publications SET terms_json=json_set(terms_json,'$.shipping_title','Changed') WHERE revision=2").run();
  await assert.rejects(()=>readOwnedWorkQuote(read),/stored_terms_changed/);
  await assert.rejects(()=>acceptWorkQuote({...read,operationId:randomUUID(),revision:2,hash:q2.hash}),/stored_terms_changed/);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM jill_work_quote_acceptances').first()).n,0);
  await db.prepare('UPDATE jill_work_quote_publications SET terms_json=? WHERE revision=2').bind(q2.json).run();
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
  assert.equal((await readOwnedWorkQuote(read)).state,'accepted');
  assert.equal((await readOwnedWorkQuote({...read,readOwnedSource:async()=>({...source,revision:4})})).state,'accepted',
    'Canonical accepted-event revision advancement must preserve the immutable accepted terms');
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
      address:q2.terms.address,shipping_title:q2.terms.shipping_title,fulfillment:q2.terms.fulfillment,
      lines:q2.terms.lines,reward:q2.terms.reward})};
  assert.equal((await advanceWorkCommerce(args)).state,'accepted_pending_event');
  assert.equal(creates,0,'No Shopify create before canonical public acceptance');
  assert.equal((await advanceWorkCommerce({...args,nowMs:now+3600001})).reason,'quote_expired');
  assert.equal(creates,0,'Expiry never permits a fresh create');
  eventConfirmed=true;
  assert.equal((await advanceWorkCommerce(args)).state,'needs_reconciliation');
  assert.equal(creates,1);
  for(let n=0;n<3;n++)assert.equal((await advanceWorkCommerce(args)).state,'needs_reconciliation');
  assert.equal(creates,1,'An empty search never authorizes another create');
  assert.equal((await advanceWorkCommerce({...args,findDrafts:async()=>{throw Error('read outage');}})).state,'needs_reconciliation');
  assert.equal(creates,1,'A read failure does not authorize another create');
  found=true;
  assert.equal((await advanceWorkCommerce({...args,nowMs:now+3600001})).state,'draft_linked',
    'A create claimed before expiry remains recoverable after expiry');
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
  // A draft's matching metadata/hash is insufficient if its actual delivery
  // fields differ. Each case is isolated in the local-only D1 fixture.
  for(const [index,change] of [
    x=>x.address={...x.address,city:'Other city'},
    x=>x.shipping_title='Different service',x=>x.fulfillment='shipping'].entries()){
    const submissionId='jill:local-delivery-'+index,operationId=randomUUID();
    const frozen=freeze(1,{submissionId});
    await publishWorkQuote({db,frozen,operationId:randomUUID(),expectedRevision:0});
    await acceptWorkQuote({...accept,submissionId,operationId,revision:1,hash:frozen.hash});
    const t=frozen.terms,actual={customer_gid:GID,quote_hash:frozen.hash,submission_id:submissionId,
      operation_id:operationId,input_sha256:t.calculation_input_sha256,address_sha256:t.address_sha256,
      currency:t.currency,totals:t.totals,lines:t.lines,reward:t.reward,address:t.address,
      shipping_title:t.shipping_title,fulfillment:t.fulfillment};
    change(actual);let calls=0;
    const mismatch={...args,submissionId,confirmPublicAcceptance:async()=>({confirmed:true,
      operation_id:operationId,submission_id:submissionId,quote_hash:frozen.hash}),
      createDraft:async()=>{calls++;return {id:'gid://shopify/DraftOrder/'+(222+index)};},readDraft:async()=>actual};
    assert.equal((await advanceWorkCommerce(mismatch)).state,'quarantined');
    assert.equal((await advanceWorkCommerce(mismatch)).state,'quarantined');
    assert.equal(calls,1);
    assert.equal(await db.prepare('SELECT * FROM jill_work_commerce_links WHERE submission_id=?').bind(submissionId).first(),null);
  }
  console.log('PASS real LOCAL D1 exact address/shipping terms and private owner projection, A/B/foreign-shop denial before reads, read outages, tamper detection, immutable revisions, stale/expired denial, atomic rollback, one acceptance/intent, lost-create reconciliation and customer mismatch quarantine.');
}finally{await harness.close();}
