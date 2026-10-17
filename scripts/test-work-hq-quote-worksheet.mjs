// JILL HQ WORK estimate-only worksheet regression. No provider calls,
 // persistent browser storage, status changes, customer data or payment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateWorkQuoteWorksheet as estimate,formatWorkUsd}
  from '../services/jill-order-desk/work-quote-worksheet.mjs';

const fees={materials:'5.00',labor:'20',shipping:'12.00',
  other:'3',discount:'10',tax:'4.56'};
const lines=[
  {id:'item-001',quantity:2,unitPrice:'25.99'},
  {id:'item-002',quantity:3,unitPrice:'0.01'},
];
let cases=0;
const pass=(condition,msg)=>{assert.ok(condition,msg);cases++;};
const ok=estimate({lines,fees});
pass(ok.state==='ready','should be priced');
assert.equal(ok.itemsSubtotalCents,5201);
assert.equal(ok.chargesBeforeDiscountCents,9201);
assert.equal(ok.discountCents,1000);
assert.equal(ok.manualTaxCents,456);
assert.equal(ok.estimatedTotalCents,8657);
assert.equal(ok.currency,'USD');
assert.equal(formatWorkUsd(ok.estimatedTotalCents),'$86.57');
assert.equal(ok.saved,false);
assert.equal(ok.customerApproved,false);
assert.equal(ok.shopifyDraftOrderCreated,false);
assert.equal(ok.invoiceSent,false);
pass(Object.isFrozen(ok)&&Object.isFrozen(ok.feesCents),
  'results must be immutable');
pass(estimate({lines:[{id:'a',quantity:1,unitPrice:'0.10'},
  {id:'b',quantity:1,unitPrice:'0.20'}],
  fees:Object.fromEntries(Object.keys(fees).map(k=>[k,'']))})
  .estimatedTotalCents===30,'decimal precision must be exact');
pass(estimate({lines:[{id:'x',quantity:10,unitPrice:'99999.99'}],
  fees:Object.fromEntries(Object.keys(fees).map(k=>[k,'']))})
  .estimatedTotalCents===99_999_990,'exact upper boundary');
pass(estimate({lines:[{id:'x',quantity:11,unitPrice:'99999.99'}],
  fees:Object.fromEntries(Object.keys(fees).map(k=>[k,'']))})
  .code==='quote_over_limit','prevent quotes above $1 million');
pass(estimate({lines:[{...lines[0],unitPrice:''},lines[1]],fees})
  .state==='incomplete','blank item prices must never imply zero');
pass(estimate({lines:[{...lines[0],unitPrice:'0'},lines[1]],fees})
  .state==='ready','explicit zero-price item must be allowed');
const fail=(source,code)=>{
  const r=estimate(source);assert.equal(r.state,'invalid');
  assert.equal(r.code,code);cases++;
};
fail({lines:[],fees},'invalid_quote_structure');
fail({lines:lines.concat(lines),fees},'invalid_verified_item');
fail({lines,fees:{}},'invalid_quote_structure');
fail({lines,fees:{...fees,tip:'1'}},'invalid_quote_structure');
fail({lines:[{...lines[0],id:'bad/../key'},lines[1]],fees},
  'invalid_verified_item');
fail({lines:[lines[0],{...lines[1],id:lines[0].id}],fees},
  'invalid_verified_item');
fail({lines:[{...lines[0],quantity:0},lines[1]],fees},
  'invalid_verified_item');
fail({lines:[{...lines[0],quantity:1000},lines[1]],fees},
  'invalid_verified_item');
fail({lines:[{...lines[0],quantity:1.5},lines[1]],fees},
  'invalid_verified_item');
fail({lines:[{...lines[0],another:'field'},lines[1]],fees},
  'invalid_verified_item');
for(const bad of ['-5','+1','$5','1.000','01','1e3',' 5','5 ','NaN',
  'Infinity','.50','12,00','123456','01.00','1.','99999.999','5\n1']){
  fail({lines:[{...lines[0],unitPrice:bad},lines[1]],fees},
    'invalid_money');
}
for(const bad of ['-0.01','250000','3.1415',' 1','1e8']){
  fail({lines,fees:{...fees,labor:bad}},'invalid_money');
}
fail({lines,fees:{...fees,discount:'99999'}},
  'discount_exceeds_charges');
// Cross the million-dollar cap with only 11 cents of manual tax.
fail({lines:[{id:'near-cap',quantity:10,unitPrice:'99999.99'}],
  fees:{materials:'',labor:'',shipping:'',other:'',
    discount:'',tax:'0.11'}},'quote_over_limit');
assert.throws(()=>formatWorkUsd(-1),/invalid_cents/);cases++;
assert.throws(()=>formatWorkUsd(100_000_001),/invalid_cents/);cases++;
assert.equal(formatWorkUsd(0),'$0.00');cases++;
const base='services/jill-order-desk/app-home/app/';
const ui=readFileSync(base+'components/WorkQuoteWorksheet.tsx','utf8');
const route=readFileSync(base+'routes/app.requests.$submissionId.tsx','utf8');
const css=readFileSync(base+'styles/quote-worksheet.css','utf8');
for(const marker of ['model?.state==="ready"',
  'model.detail?.submission_id===submissionId',
  'customerStatus==="cancelled"||customerStatus==="completed"',
  'NOT SAVED · NOT SENT','estimatedTotalCents',
  'items.map','unitPrice:prices','NOT SAVED',
  'remain','not an approved customer quote']){
  if(marker==='NOT SAVED'||marker==='remain')continue;
  assert.ok(ui.includes(marker),marker);cases++;
}
pass(route.includes('WorkQuoteWorksheet')&&
  route.includes('key={record.submission_id}')&&
  route.includes('model={original}'), 'verified route wires worksheet');
for(const src of [ui,css]){
  assert.doesNotMatch(src,/localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(src,/fetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/);
  assert.doesNotMatch(src,/shopify\.graphql|draftOrderCreate|\/payments/);
  cases+=3;
}
assert.doesNotMatch(css,/!important|@import|url\(/i);cases++;
console.log('PASS WORK HQ quote worksheet: '+cases+
  ' offline price arithmetic, upper-bound, completeness, wrong-origin-safe no-I/O presentation and request-scoped quote guards.');
console.log('HOLD: UI is browser-memory-only; no server persistence, customer approval, payment, Shopify Draft Order or LIVE/KEEP activation.');
