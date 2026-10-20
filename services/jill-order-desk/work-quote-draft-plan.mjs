// JILL HQ WORK — SOURCE ONLY inert local-D1 quote draft write plans.
// This never authenticates a real Owner, opens a database, dispatches
// network calls, saves to Shopify, invoices or changes a merchant record.
// A future Owner/D1 route MUST authenticate BEFORE supplying signed
// exact Google QA detail + current source revision. There is NO route now.
import {createHash} from 'node:crypto';
import {evaluateWorkQuoteWorksheet} from './work-quote-worksheet.mjs';
const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const OP=/^jill:hq:quote:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
const FIELDS=['shop','submissionId','detail','record','lines','fees',
  'expectedDraftRevision','operationId','nowMs'];
const deny=()=>{throw Error('jill_work_quote_draft_not_authorized');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&
  keys.every(k=>Object.hasOwn(x,k));
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const safe=plan=>Object.freeze({
  ...plan,
  local_execution_permitted_for_synthetic_tests:true,
  remote_d1_migration_authorized:false,
  remote_d1_write_authorized:false,
  authenticated_owner_verified:false,
  customer_access_granted:false,
  quote_saved_to_real_work:false,
  payment_authorized:false,
  shopify_draft_order_authorized:false,
  version_upload_authorized:false,
  traffic_switch_authorized:false,
});
function sourceSnapshot(input){
  const {submissionId,detail,record,lines}=input;
  if(!object(detail)||detail.submission_id!==submissionId||
     !Number.isSafeInteger(detail.revision)||detail.revision<1||
     detail.revision>100||!Array.isArray(detail.items)||
     detail.items.length<1||detail.items.length>50||
     !object(record)||record.submission_id!==submissionId||
     record.revision!==detail.revision||
     typeof record.customer_status!=='string'||
     !['received','reviewing','awaiting_approval','in_production',
       'ready_pickup','on_hold'].includes(record.customer_status)||
     !Array.isArray(lines)||lines.length!==detail.items.length)
    deny();
  const seen=new Set();
  const itemLines=[];
  for(const item of detail.items){
    if(!object(item)||typeof item.item_id!=='string'||
       !ID.test(item.item_id)||seen.has(item.item_id)||
       !Number.isSafeInteger(item.quantity)||item.quantity<1||
       item.quantity>999)deny();
    seen.add(item.item_id);
    const found=lines.filter(x=>object(x)&&x.id===item.item_id);
    if(found.length!==1||found[0].quantity!==item.quantity)deny();
    itemLines.push({
      item_id:item.item_id,quantity:item.quantity,
      unit_price_text:found[0].unitPrice,
    });
  }
  if(new Set(lines.map(x=>x?.id)).size!==lines.length)deny();
  return itemLines;
}
export function planLocalWorkQuoteDraftSave(input){
  if(!own(input,FIELDS)||input.shop!==SHOP||
     typeof input.submissionId!=='string'||!ID.test(input.submissionId)||
     typeof input.operationId!=='string'||!OP.test(input.operationId)||
     !Number.isSafeInteger(input.expectedDraftRevision)||
     input.expectedDraftRevision<0||input.expectedDraftRevision>=100||
     !Number.isSafeInteger(input.nowMs)||input.nowMs<1_600_000_000_000)
    deny();
  const sourceLines=sourceSnapshot(input);
  const sanitizedLines=sourceLines.map(x=>({
    id:x.item_id,quantity:x.quantity,unitPrice:x.unit_price_text,
  }));
  const estimate=evaluateWorkQuoteWorksheet({
    lines:sanitizedLines,fees:input.fees,
  });
  if(estimate.state!=='ready')deny();
  const quoteLines=sourceLines.map(x=>({
    item_id:x.item_id,quantity:x.quantity,
    unit_price_cents:estimateLineCents(x.unit_price_text),
  }));
  // The source fingerprint includes only verified immutable item identity
  // and quantities, never email, customer names or artwork references.
  const identity=JSON.stringify({
    shop:SHOP,submission_id:input.submissionId,
    source_revision:input.detail.revision,
    items:quoteLines.map(({item_id,quantity})=>({item_id,quantity})),
  });
  const sourceSha=sha('jill_work_quote_source_v1\n'+identity);
  const quote=Object.freeze({
    version:1,currency:'USD',source_revision:input.detail.revision,
    items:quoteLines,
    fees_cents:estimate.feesCents,
    subtotal_cents:estimate.itemsSubtotalCents,
    total_cents:estimate.estimatedTotalCents,
  });
  const json=JSON.stringify(quote);
  if(Buffer.byteLength(json,'utf8')>25000)deny();
  const quoteSha=sha('jill_work_quote_draft_v1\n'+json);
  const create=input.expectedDraftRevision===0;
  const draftParams=create?[
    SHOP,input.submissionId,1,input.detail.revision,sourceSha,quoteSha,
    json,estimate.estimatedTotalCents,'USD','draft',input.operationId,
    input.nowMs,input.nowMs,
  ]:[
    input.detail.revision,sourceSha,quoteSha,json,
    estimate.estimatedTotalCents,input.operationId,input.nowMs,
    SHOP,input.submissionId,input.expectedDraftRevision,
    sourceSha,input.detail.revision,
  ];
  const sql=create?
    'INSERT INTO jill_work_quote_drafts '+
    '(shop,submission_id,draft_revision,source_revision,source_sha256,'+
    'quote_sha256,quote_json,total_cents,currency,state,'+
    'last_operation_id,created_at_ms,updated_at_ms) '+
    'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) '+
    'ON CONFLICT(shop,submission_id) DO NOTHING '+
    'RETURNING draft_revision,quote_sha256':
    'UPDATE jill_work_quote_drafts SET draft_revision=draft_revision+1,'+
    'source_revision=?,source_sha256=?,quote_sha256=?,quote_json=?,'+
    'total_cents=?,last_operation_id=?,updated_at_ms=? '+
    'WHERE shop=? AND submission_id=? AND draft_revision=? '+
    'AND source_sha256=? AND source_revision=? AND state=\'draft\' '+
    'AND draft_revision<100 RETURNING draft_revision,quote_sha256';
  // All-or-nothing db.batch: if the draft changes, append a UNIQUE op
  // receipt. Reusing an op after a newer revision fails the unique PK and
  // MUST roll back the draft update. A CAS miss inserts no operation.
  const receiptSql='INSERT INTO jill_work_quote_draft_operations '+
    '(shop,operation_id,submission_id,draft_revision,quote_sha256,created_at_ms) '+
    'SELECT ?,?,?,draft_revision,quote_sha256,? '+
    'FROM jill_work_quote_drafts WHERE shop=? AND submission_id=? '+
    'AND last_operation_id=? AND changes()=1';
  return safe({
    kind:'synthetic_work_quote_draft_d1_batch_plan',
    shop:SHOP,submission_id:input.submissionId,
    source_sha256:sourceSha,quote_sha256:quoteSha,
    next_draft_revision:input.expectedDraftRevision+1,
    quoted_total_cents:estimate.estimatedTotalCents,
    statements:Object.freeze([
      Object.freeze({sql,params:Object.freeze(draftParams)}),
      Object.freeze({sql:receiptSql,params:Object.freeze([
        SHOP,input.operationId,input.submissionId,input.nowMs,
        SHOP,input.submissionId,input.operationId,
      ])}),
    ]),
    receipt_lookup:Object.freeze({
      sql:'SELECT submission_id,draft_revision,quote_sha256 '+
        'FROM jill_work_quote_draft_operations '+
        'WHERE shop=? AND operation_id=?',
      params:Object.freeze([SHOP,input.operationId]),
    }),
  });
}
function estimateLineCents(text){
  if(typeof text!=='string'||!
     /^(?:0|[1-9]\d{0,4})(?:\.\d{1,2})?$/.test(text))deny();
  const [whole,part='']=text.split('.');
  return Number(whole)*100+Number(part.padEnd(2,'0'));
}
export function inspectLocalWorkQuoteDraftReceipt({plan,receipt}={}){
  if(plan?.kind!=='synthetic_work_quote_draft_d1_batch_plan')deny();
  if(receipt===null)return safe({
    kind:'no_matching_operation_receipt',
    outcome:'not_confirmed_do_not_retry_automatically',
  });
  if(!object(receipt)||
     Object.keys(receipt).sort().join(',')!==
       'draft_revision,quote_sha256,submission_id'||
     receipt.submission_id!==plan.submission_id||
     !Number.isSafeInteger(receipt.draft_revision)||
     receipt.draft_revision!==plan.next_draft_revision||
     !HASH.test(receipt.quote_sha256)||receipt.quote_sha256!==plan.quote_sha256)
    return safe({kind:'operation_receipt_conflict',
      outcome:'stop_draft_reconciliation_required'});
  return safe({kind:'matching_synthetic_operation_receipt',
    outcome:'locally_recorded_only',revision:receipt.draft_revision});
}
