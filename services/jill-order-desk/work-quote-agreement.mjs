// Internal WORK agreement repository/orchestrator. No HTTP ingress and no
// Shopify API credentials here. Runtime adapters/activation need separate
// owner/session/scope, canonical-event and actual Shopify read-back proof.
import {createHash} from 'node:crypto';
const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const HASH=/^[a-f0-9]{64}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const deny=code=>{throw Error('work_agreement_'+code);};
const integer=(n,max=100000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
function stable(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&Object.getPrototypeOf(value)===Object.prototype)
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  deny('invalid_terms');
}
export const agreementHash=value=>createHash('sha256').update(stable(value)).digest('hex');
function key(submissionId,operationId){
  if(!ID.test(submissionId||'')||!UUID.test(operationId||''))deny('invalid_key');
}
// calculation is supplied by the trusted Shopify adapter, NEVER browser totals.
export function freezeWorkQuote({submissionId,revision,source,calculation,
  expiresAtMs,nowMs,staffId}={}){
  if(!ID.test(submissionId||'')||!integer(revision,100)||revision<1||
    !GID.test(source?.customer_gid)||!integer(source?.revision,100)||source.revision<1||
    !HASH.test(source?.sha256)||!Number.isSafeInteger(nowMs)||
    !Number.isSafeInteger(expiresAtMs)||expiresAtMs<=nowMs||expiresAtMs>nowMs+7*86400000||
    !/^[1-9][0-9]*$/.test(staffId||''))deny('invalid_publication');
  const c=calculation;
  if(c?.shop!==SHOP||c.customer_gid!==source.customer_gid||c.currency!=='USD'||
    !HASH.test(c.input_sha256)||!HASH.test(c.address_sha256)||
    !Number.isSafeInteger(c.calculated_at_ms)||nowMs-c.calculated_at_ms<0||
    nowMs-c.calculated_at_ms>30000||!Array.isArray(c.lines)||
    c.lines.length<1||c.lines.length>20||
    !['pickup','shipping'].includes(c.fulfillment))deny('calculation_unverified');
  const lines=c.lines.map(line=>{
    if(!/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(line.variant_id)||
      !integer(line.quantity,999)||line.quantity<1||!integer(line.subtotal_cents)||
      typeof line.options!=='string'||line.options.length>500)deny('invalid_line');
    return {variant_id:line.variant_id,quantity:line.quantity,
      subtotal_cents:line.subtotal_cents,options:line.options};
  });
  if(new Set(lines.map(x=>x.variant_id)).size!==lines.length)deny('duplicate_variant');
  const totals={items_cents:lines.reduce((sum,x)=>sum+x.subtotal_cents,0),
    shipping_cents:c.shipping_cents,tax_cents:c.tax_cents,
    discount_cents:c.discount_cents,total_cents:c.total_cents};
  if(Object.values(totals).some(x=>!integer(x))||
    totals.items_cents+totals.shipping_cents+totals.tax_cents-totals.discount_cents!==totals.total_cents)
    deny('calculation_total_mismatch');
  let reward=null;
  if(c.reward){
    const r=c.reward;
    if(!ID.test(r.reservation_id)||typeof r.code!=='string'||!/^[A-Za-z0-9_-]{4,80}$/.test(r.code)||
      !integer(r.discount_cents)||r.discount_cents!==totals.discount_cents||
      !['v13','universal_v1'].includes(r.policy))deny('reward_unverified');
    reward={reservation_id:r.reservation_id,code:r.code,discount_cents:r.discount_cents,policy:r.policy};
  }
  const terms={version:1,shop:SHOP,submission_id:submissionId,revision,
    customer_gid:source.customer_gid,source_revision:source.revision,
    source_sha256:source.sha256,currency:'USD',lines,totals,reward,
    fulfillment:c.fulfillment,address_sha256:c.address_sha256,
    calculation_input_sha256:c.input_sha256,expires_at_ms:expiresAtMs};
  const json=stable(terms);if(Buffer.byteLength(json)>25000)deny('terms_too_large');
  return {terms,json,hash:agreementHash(terms),staffId,nowMs};
}
const first=(db,sql,...values)=>db.prepare(sql).bind(...values).first();
export async function publishWorkQuote({db,frozen,operationId,expectedRevision}={}){
  const t=frozen.terms;key(t.submission_id,operationId);
  if(!integer(expectedRevision,99)||t.revision!==expectedRevision+1||
    agreementHash(JSON.parse(frozen.json))!==frozen.hash||
    agreementHash(t)!==frozen.hash)deny('publication_changed');
  const previous=await first(db,'SELECT * FROM jill_work_quote_publications WHERE shop=? AND operation_id=?',SHOP,operationId);
  if(previous){if(previous.quote_sha256!==frozen.hash||previous.submission_id!==t.submission_id)deny('operation_conflict');return {revision:previous.revision,hash:previous.quote_sha256};}
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO jill_work_quote_heads VALUES (?,?,0,?)').bind(SHOP,t.submission_id,''),
    db.prepare('UPDATE jill_work_quote_heads SET revision=?,operation_id=? WHERE shop=? AND submission_id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM jill_work_quote_acceptances WHERE shop=? AND submission_id=?)')
      .bind(t.revision,operationId,SHOP,t.submission_id,expectedRevision,SHOP,t.submission_id),
    db.prepare('INSERT INTO jill_work_quote_publications SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM jill_work_quote_heads WHERE shop=? AND submission_id=? AND operation_id=? AND revision=?)')
      .bind(SHOP,t.submission_id,t.revision,operationId,t.customer_gid,t.source_revision,
        t.source_sha256,frozen.hash,frozen.json,frozen.staffId,frozen.nowMs,t.expires_at_ms,
        SHOP,t.submission_id,operationId,t.revision),
  ]);
  const saved=await first(db,'SELECT quote_sha256 FROM jill_work_quote_publications WHERE shop=? AND operation_id=?',SHOP,operationId);
  if(saved?.quote_sha256!==frozen.hash)deny('publication_revision_changed');
  return {revision:t.revision,hash:frozen.hash};
}
export async function acceptWorkQuote({db,submissionId,operationId,revision,hash,
  identity,readOwnedSource,nowMs=Date.now()}={}){
  key(submissionId,operationId);
  if(identity?.shop!==SHOP||!GID.test(identity.customerGid)||!HASH.test(hash)||
    !integer(revision,100)||revision<1)deny('unauthorized');
  // Server derives identity; this callback must query the canonical Google
  // owner ledger with that GID and immutable intake hash, not contact email.
  const source=await readOwnedSource({submissionId,customerGid:identity.customerGid});
  if(source?.customer_gid!==identity.customerGid||!HASH.test(source.sha256))deny('owner_unverified');
  const existing=await first(db,'SELECT * FROM jill_work_quote_acceptances WHERE shop=? AND (submission_id=? OR operation_id=?)',SHOP,submissionId,operationId);
  if(existing){
    if(existing.customer_gid!==identity.customerGid||existing.submission_id!==submissionId||
      existing.quote_revision!==revision||existing.quote_sha256!==hash)deny('acceptance_conflict');
    return {operation_id:existing.operation_id,state:'processing',duplicate:true};
  }
  await db.batch([
    db.prepare(`INSERT INTO jill_work_quote_acceptances
      SELECT p.shop,p.submission_id,p.revision,p.quote_sha256,p.customer_gid,?,?
      FROM jill_work_quote_publications p JOIN jill_work_quote_heads h
      ON p.shop=h.shop AND p.submission_id=h.submission_id AND p.revision=h.revision
      WHERE p.shop=? AND p.submission_id=? AND p.revision=? AND p.quote_sha256=?
      AND p.customer_gid=? AND p.source_revision=? AND p.source_sha256=? AND p.expires_at_ms>?`)
      .bind(operationId,nowMs,SHOP,submissionId,revision,hash,identity.customerGid,source.revision,source.sha256,nowMs),
    db.prepare(`INSERT INTO jill_work_commerce_intents
      SELECT shop,submission_id,operation_id,'accepted_pending_event',NULL
      FROM jill_work_quote_acceptances WHERE shop=? AND submission_id=? AND operation_id=?`)
      .bind(SHOP,submissionId,operationId),
  ]);
  const saved=await first(db,'SELECT operation_id FROM jill_work_quote_acceptances WHERE shop=? AND submission_id=?',SHOP,submissionId);
  if(saved?.operation_id!==operationId)deny('stale_or_expired_quote');
  return {operation_id:operationId,state:'processing',duplicate:false};
}
// One creation claim per request. A lost create response ALWAYS holds. Neither
// timeout nor a Shopify search returning zero is permission to create again.
export async function advanceWorkCommerce({db,submissionId,confirmPublicAcceptance,
  authorizeStaff,createDraft,readDraft,findDrafts,reconcileOnly=false,nowMs=Date.now()}={}){
  if(!ID.test(submissionId||''))deny('invalid_key');
  const intent=await first(db,'SELECT * FROM jill_work_commerce_intents WHERE shop=? AND submission_id=?',SHOP,submissionId);
  if(!intent)deny('acceptance_missing');
  if(intent.state==='quarantined')return {state:'quarantined'};
  const existing=await first(db,'SELECT * FROM jill_work_commerce_links WHERE shop=? AND submission_id=?',SHOP,submissionId);
  if(existing)return {state:'draft_linked',draft_gid:existing.draft_gid};
  const publication=await first(db,`SELECT p.* FROM jill_work_quote_publications p
    JOIN jill_work_quote_acceptances a ON p.shop=a.shop AND p.submission_id=a.submission_id
    AND p.revision=a.quote_revision WHERE p.shop=? AND p.submission_id=?`,SHOP,submissionId);
  const terms=JSON.parse(publication.terms_json);
  if(agreementHash(terms)!==publication.quote_sha256)deny('stored_terms_changed');
  if(!await authorizeStaff(publication.staff_id))deny('staff_revoked');
  if(terms.expires_at_ms<=nowMs)return {state:'needs_reconciliation',reason:'quote_expired'};
  let state=intent.state;
  if(state==='accepted_pending_event'){
    const event=await confirmPublicAcceptance({submissionId,operationId:intent.operation_id,
      quoteHash:publication.quote_sha256,sourceRevision:publication.source_revision});
    if(event?.confirmed!==true||event.operation_id!==intent.operation_id||
      event.submission_id!==submissionId||event.quote_hash!==publication.quote_sha256)return {state};
    await db.prepare("UPDATE jill_work_commerce_intents SET state='event_confirmed' WHERE shop=? AND submission_id=? AND state='accepted_pending_event'").bind(SHOP,submissionId).run();
    state='event_confirmed';
  }
  let id=null;
  if(state==='event_confirmed'&&!reconcileOnly){
    const claimed=await db.prepare("UPDATE jill_work_commerce_intents SET state='creating_draft' WHERE shop=? AND submission_id=? AND state='event_confirmed'").bind(SHOP,submissionId).run();
    if(claimed.meta.changes!==1)return {state:'processing'};
    try{id=(await createDraft({terms,quoteHash:publication.quote_sha256,operationId:intent.operation_id})).id;}
    catch{
      await db.prepare("UPDATE jill_work_commerce_intents SET state='needs_reconciliation' WHERE shop=? AND submission_id=? AND state='creating_draft'").bind(SHOP,submissionId).run();
      return {state:'needs_reconciliation'};
    }
  }else if(['creating_draft','needs_reconciliation'].includes(state)){
    const candidates=intent.draft_gid?[{id:intent.draft_gid}]:
      await findDrafts({submissionId,quoteHash:publication.quote_sha256});
    if(!Array.isArray(candidates)||candidates.length!==1)return {state:'needs_reconciliation'};
    id=candidates[0].id;
  }else return {state};
  if(!/^gid:\/\/shopify\/DraftOrder\/[1-9][0-9]*$/.test(id||''))deny('invalid_draft_reference');
  // Store the observed external ID even if read-back fails, for recovery.
  await db.prepare('UPDATE jill_work_commerce_intents SET draft_gid=? WHERE shop=? AND submission_id=?').bind(id,SHOP,submissionId).run();
  let actual;
  try{actual=await readDraft(id);}catch{return {state:'needs_reconciliation'};}
  if(actual?.customer_gid!==terms.customer_gid||actual.quote_hash!==publication.quote_sha256||
    actual.submission_id!==submissionId||actual.operation_id!==intent.operation_id||
    actual.input_sha256!==terms.calculation_input_sha256||
    actual.address_sha256!==terms.address_sha256||actual.currency!==terms.currency||
    agreementHash(actual.totals)!==agreementHash(terms.totals)||
    agreementHash(actual.lines)!==agreementHash(terms.lines)||
    agreementHash(actual.reward??null)!==agreementHash(terms.reward)){
    await db.prepare("UPDATE jill_work_commerce_intents SET state='quarantined' WHERE shop=? AND submission_id=?").bind(SHOP,submissionId).run();
    return {state:'quarantined'};
  }
  await db.batch([
    db.prepare('INSERT INTO jill_work_commerce_links VALUES (?,?,?,?,?)').bind(SHOP,submissionId,id,null,publication.quote_sha256),
    db.prepare("UPDATE jill_work_commerce_intents SET state='draft_linked' WHERE shop=? AND submission_id=?").bind(SHOP,submissionId),
  ]);
  return {state:'draft_linked',draft_gid:id};
}

export async function reconcileWorkOrder({db,submissionId,readDraft,readOrder,nowMs=Date.now()}={}){
  const intent=await first(db,'SELECT state FROM jill_work_commerce_intents WHERE shop=? AND submission_id=?',SHOP,submissionId);
  if(intent?.state==='quarantined')return {state:'quarantined'};
  const link=await first(db,'SELECT * FROM jill_work_commerce_links WHERE shop=? AND submission_id=?',SHOP,submissionId);
  if(!link)deny('draft_link_missing');
  const accepted=await first(db,'SELECT customer_gid,operation_id FROM jill_work_quote_acceptances WHERE shop=? AND submission_id=?',SHOP,submissionId);
  const draft=await readDraft(link.draft_gid);
  if(!draft?.order_gid)return {state:'awaiting_shopify_checkout'};
  if(!/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/.test(draft.order_gid))deny('invalid_order_reference');
  const order=await readOrder(draft.order_gid);
  if(order?.customer_gid!==accepted.customer_gid||order.submission_id!==submissionId||
    order.quote_hash!==link.quote_sha256||order.operation_id!==accepted.operation_id||
    (link.order_gid&&link.order_gid!==draft.order_gid)){
    await db.prepare("UPDATE jill_work_commerce_intents SET state='quarantined' WHERE shop=? AND submission_id=?").bind(SHOP,submissionId).run();
    return {state:'quarantined'};
  }
  await db.prepare('UPDATE jill_work_commerce_links SET order_gid=? WHERE shop=? AND submission_id=? AND (order_gid IS NULL OR order_gid=?)')
    .bind(draft.order_gid,SHOP,submissionId,draft.order_gid).run();
  return {state:'shopify_order_verified',order_gid:draft.order_gid,
    observed_at_ms:nowMs,financial_status:order.financial_status,
    fulfillment_status:order.fulfillment_status};
}
