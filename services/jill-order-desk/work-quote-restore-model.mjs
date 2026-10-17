// Presentation-only hydration of a backend-VERIFIED saved WORK quote draft.
// No I/O, URL fetch, storage writes, quote approval or payment. Never
// hydrate merely from a raw D1 row, customer body or localStorage.
import {evaluateWorkQuoteWorksheet} from './work-quote-worksheet.mjs';
const KEYS=['materials','labor','shipping','other','discount','tax'];
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const money=/^(?:0|[1-9]\d{0,6})\.\d{2}$/;
export function hydrateVerifiedWorkQuoteWorksheet({
  draft,detail,submissionId,
}={}){
  if(!object(draft)||draft.state!=='ready'||
     !ID.test(submissionId||'')||
     draft.submission_id!==submissionId||
     !object(detail)||detail.submission_id!==submissionId||
     detail.revision!==draft.source_revision||
     !Array.isArray(detail.items)||detail.items.length<1||
     detail.items.length>50||
     !Array.isArray(draft.lines)||
     detail.items.length!==draft.lines.length||
     !object(draft.fees)||Object.keys(draft.fees).length!==KEYS.length||
     !KEYS.every(k=>typeof draft.fees[k]==='string'&&
       money.test(draft.fees[k]))||
     !Number.isSafeInteger(draft.draft_revision)||
     draft.draft_revision<1||draft.draft_revision>100||
     !Number.isSafeInteger(draft.estimated_total_cents))
    return null;
  const prices=Object.create(null);
  const lines=[];
  const seen=new Set();
  for(let i=0;i<draft.lines.length;i++){
    const saved=draft.lines[i],original=detail.items[i];
    if(!object(saved)||!object(original)||
       !ID.test(saved.id||'')||seen.has(saved.id)||
       saved.id!==original.item_id||
       saved.quantity!==original.quantity||
       typeof saved.unitPrice!=='string'||!
       money.test(saved.unitPrice))
      return null;
    seen.add(saved.id);
    lines.push({id:saved.id,quantity:saved.quantity,
      unitPrice:saved.unitPrice});
    prices[saved.id]=saved.unitPrice;
  }
  const calculated=evaluateWorkQuoteWorksheet({
    lines,fees:draft.fees,
  });
  if(calculated.state!=='ready'||
     calculated.estimatedTotalCents!==draft.estimated_total_cents)
    return null;
  return Object.freeze({
    state:'verified_draft_restore',
    draftRevision:draft.draft_revision,
    prices:Object.freeze({...prices}),
    fees:Object.freeze(Object.fromEntries(KEYS.map(k=>[k,draft.fees[k]]))),
    estimatedTotalCents:calculated.estimatedTotalCents,
    customerApprovalGranted:false,
    saveRequested:false,
  });
}
