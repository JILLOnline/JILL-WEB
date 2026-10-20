// Local-only WORK draft request envelope; NO HTTP, provider access or
// grant of authorization. The Worker and route remain HARD OFF in source.
// Only server-side fresh authenticated Google QA and D1 CAS can authorize.
import {evaluateWorkQuoteWorksheet} from './work-quote-worksheet.mjs';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const OP=/^jill:hq:quote:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STATUSES=new Set(['received','reviewing','awaiting_approval',
  'in_production','ready_pickup','on_hold']);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const invalid=code=>Object.freeze({state:'blocked',code});
const feeKeys=['materials','labor','shipping','other','discount','tax'];
export function prepareWorkQuoteUiSavePayload({
  submissionId,detail,sourceRevision,customerStatus,
  prices,fees,draftRevision,operationId,
}={}){
  if(!ID.test(submissionId||'')||!object(detail)||
     detail.submission_id!==submissionId||
     detail.revision!==sourceRevision||
     !Number.isSafeInteger(sourceRevision)||sourceRevision<1||
     sourceRevision>100||!STATUSES.has(customerStatus)||
     !Number.isSafeInteger(draftRevision)||draftRevision<0||
     draftRevision>=100||
     !OP.test(operationId||'')||!object(prices)||!object(fees)||
     Object.keys(fees).length!==feeKeys.length||
     !feeKeys.every(k=>Object.hasOwn(fees,k)&&
       typeof fees[k]==='string')||
     !Array.isArray(detail.items)||detail.items.length<1||
     detail.items.length>50)
    return invalid('verified_source_unavailable');
  const seen=new Set();
  const lines=[];
  for(const item of detail.items){
    if(!object(item)||!ID.test(item.item_id||'')||
       seen.has(item.item_id)||!Number.isSafeInteger(item.quantity)||
       item.quantity<1||item.quantity>999||
       typeof prices[item.item_id]!=='string')
      return invalid('invalid_verified_items');
    seen.add(item.item_id);
    lines.push(Object.freeze({
      id:item.item_id,quantity:item.quantity,unitPrice:prices[item.item_id],
    }));
  }
  // Unknown submitted IDs may never be smuggled into a valid quote draft.
  if(Object.keys(prices).some(id=>!seen.has(id)))
    return invalid('unverified_price_item');
  const estimate=evaluateWorkQuoteWorksheet({lines,fees});
  if(estimate.state!=='ready')return invalid(estimate.code);
  return Object.freeze({
    state:'ready',
    estimatedTotalCents:estimate.estimatedTotalCents,
    // Only these six top-level fields reach the Owner-authenticated handler.
    payload:Object.freeze({
      submission_id:submissionId,operation_id:operationId,
      source_revision:sourceRevision,
      expected_draft_revision:draftRevision,
      lines:Object.freeze(lines),
      fees:Object.freeze(Object.fromEntries(feeKeys.map(k=>[k,fees[k]]))),
    }),
    remote_d1_write_authorized:false,shopify_invoice_authorized:false,
  });
}
export function workQuoteDraftReadPath(submissionId){
  if(typeof submissionId!=='string'||!ID.test(submissionId))
    throw Error('invalid_quote_request_id');
  return '/app/requests/quote-draft?submission_id='+
    encodeURIComponent(submissionId);
}
