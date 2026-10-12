import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,createHmac} from 'node:crypto';

const gs=fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const slice=(begin,end)=>{
  const a=gs.indexOf(begin),b=gs.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,`Expected canonical GS anchors: ${begin}`);
  return gs.slice(a,b);
};
const source=[
  slice('function jillCustomOrderCustomerProjection_','function jillCustomOrderMerchantRead'),
  slice('function jillCustomOrderGatewaySignature_','function jillCustomOrderGatewaySubmissionAllowed_'),
  slice('/* WORK CUSTOM ORDER OWNERSHIP V1','/* END WORK CUSTOM ORDER OWNERSHIP V1 */')
].join('\n');
class Sheet {
  constructor(rows=[]){this.rows=rows;}
  getLastRow(){return this.rows.length;}
  appendRow(r){this.rows.push([...r]);}
  setFrozenRows(){return this;}
  getRange(row,col,count=1,width=1) {
    return {
      getValues:()=>Array.from({length:count},(_,i)=>
        Array.from({length:width},(_,j)=>this.rows[row+i-1]?.[col+j-1]??'')),
      getValue:()=>this.rows[row-1]?.[col-1]??'',
      setValues:values=>values.forEach((rowData,i)=>{
        while(this.rows.length<row+i)this.rows.push([]);
        rowData.forEach((v,j)=>{this.rows[row+i-1][col+j-1]=v;});
      }),
    };
  }
}
const owners=new Map();
const submissions=new Sheet([
  ['submission_id','raw_payload'],
]);
const events=new Sheet([]);
const spreadsheet={
  getSheetByName:name=>({
    Submissions:submissions,CustomOrderEvents:events,...Object.fromEntries(owners),
  })[name]||null,
  insertSheet:name=>{
    assert.equal(name,'CustomOrderOwners','No second data authority allowed');
    const s=new Sheet();
    owners.set(name,s);
    return s;
  },
};
const id1='jill:qa:account-111',id2='jill:qa:guest-222';
const raw1=JSON.stringify({submission_id:id1,customer:{email:'a@example.test'}});
const raw2=JSON.stringify({submission_id:id2,customer:{email:'b@example.test'}});
const gidA='gid://shopify/Customer/111';
const gidB='gid://shopify/Customer/222';
const googleSecret='isolated-work-qa-test-only-gateway-key-of-sufficient-length';
const eventMap=new Map();
const box={
  JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
  JILL:{SHEET_ID:'QA-SHEET',SHEET_NAME:'Submissions'},
  HEADERS:['submission_id','raw_payload'],
  SpreadsheetApp:{
    openById:id=>{assert.equal(id,'QA-SHEET');return spreadsheet;},
    flush:()=>{},
  },
  Utilities:{
    DigestAlgorithm:{SHA_256:'sha256'},
    computeDigest:(algo,msg)=>[...createHash('sha256').update(msg).digest()].map(v=>v>127?v-256:v),
    computeHmacSha256Signature:(message,secret)=>[
      ...createHmac('sha256',secret).update(message).digest()
    ].map(v=>v>127?v-256:v),
  },
  PropertiesService:{getScriptProperties:()=>({
    getProperty:key=>key==='JILL_CUSTOM_ORDER_GATEWAY_SECRET'?googleSecret:''
  })},
  LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
  getSheet_:()=>submissions,
  jillCustomOrderEventsSheet_:()=>events,
  jillCustomOrderEventsFor_:(_sheet,id)=>eventMap.get(id)||[],
  findSubmissionRow_:(_sheet,id)=>submissions.rows.findIndex((row,i)=>i>0&&row[0]===id)+1,
  clean_:v=>String(v??'').trim(),
  constantTimeEqual_:(a,b)=>typeof a==='string'&&typeof b==='string'&&
    a.length===b.length&&a===b,
  json_:x=>x,
  Date,JSON,String,Number,Math,Array,Object,Error,Set,console,
};
vm.createContext(box);
vm.runInContext(source,box,{filename:'JILL_Custom_Order_Ownership.gs'});
const bind=box.jillCustomOrderOwnerBind_;
const list=box.jillCustomOrderGatewayCustomerList_;
const check=box.jillCustomOrderGatewayVerified_;
const norm=x=>JSON.parse(JSON.stringify(x));
const ownerSheet=()=>owners.get('CustomOrderOwners');
const ev1=[
  {revision:1,customer_status:'received',internal_status:'new',
    occurred_at:'2026-10-12T18:00:00.000Z',public_note:'',
    internal_note:'HIDDEN from customers',actor:'internal@example.test'},
  {revision:2,customer_status:'reviewing',internal_status:'needs_quote',
    occurred_at:'2026-10-12T19:00:00.000Z',
    public_note:'Your order is being reviewed.',
    internal_note:'PRIVATE margin and price',actor:'internal@example.test'},
];
assert.equal(bind(id1,gidA,raw1,false),true);
assert.equal(ownerSheet().rows.length,2);
submissions.appendRow([id1,raw1]);
eventMap.set(id1,ev1);
assert.equal(bind(id1,gidA,raw1,true),true,'Exact owner and payload replay');
assert.equal(ownerSheet().rows.length,2,'Exact replay never appends owner');
assert.throws(()=>bind(id1,gidB,raw1,true),/ownership cannot change/);
assert.throws(()=>bind(id1,'',raw1,true),/ownership cannot change/);
assert.throws(()=>bind(id1,gidA,raw2,true),/ownership cannot change/);
assert.throws(()=>bind(id1,'gid://shopify/Customer/0',raw1,false),/Invalid owner/);
assert.equal(bind(id2,'',raw2,false),false,'Guest remains unowned');
submissions.appendRow([id2,raw2]);
assert.throws(()=>bind(id2,gidA,raw2,true),/ownership cannot change/,
  'Signed-in replay MUST NOT claim original anonymous intake');
assert.equal(ownerSheet().rows.length,2);
const orphan='jill:qa:orphan-333',oraw='{"test":"orphan"}';
assert.equal(bind(orphan,gidB,oraw,false),true);
assert.throws(()=>bind(orphan,gidA,oraw,false),/Conflicting owner/);
assert.equal(bind(orphan,gidB,oraw,false),true,'Interrupted write owner can reconcile');
submissions.appendRow([orphan,oraw]);
eventMap.set(orphan,[{...ev1[0],public_note:'recovered'}]);
const timestamp=String(Date.now());
function signedCustomerRequest(gid) {
  const id='jill:account-orders';
  return {parameter:{
    jill_order_customer_list:'1',submission_id:id,
    jill_order_owner_gid:gid,jill_order_gateway_ts:timestamp,
    jill_order_gateway_sig:box.jillCustomOrderGatewaySignature_(
      'customer_list',id,timestamp,gid,googleSecret),
  }};
}
const requestA=signedCustomerRequest(gidA);
assert.equal(check(requestA,'customer_list'),true);
const readA=norm(list(requestA));
assert.equal(readA.ok,true);
assert.equal(readA.orders.length,1);
assert.equal(readA.orders[0].submission_id,id1);
assert.equal(readA.orders[0].status,'reviewing');
assert.equal(readA.orders[0].revision,2);
assert.equal(readA.orders[0].timeline.length,2);
assert.equal(JSON.stringify(readA).includes('PRIVATE'),false);
assert.equal(JSON.stringify(readA).includes('internal_note'),false);
assert.equal(JSON.stringify(readA).includes('internal_status'),false);
assert.equal(JSON.stringify(readA).includes('actor'),false);
assert.deepEqual(norm(list(signedCustomerRequest('gid://shopify/Customer/444')).orders),[],
  'Customer C cannot see Customer A or B submissions');
const readB=norm(list(signedCustomerRequest(gidB)));
assert.equal(readB.orders.length,1);
assert.equal(readB.orders[0].submission_id,orphan);
const spoof=signedCustomerRequest(gidA);
spoof.parameter.jill_order_owner_gid=gidB;
assert.equal(check(spoof,'customer_list'),false);
assert.equal(list(spoof).ok,false,'Tampered owner denied');
const guestSigned=signedCustomerRequest(gidA);
guestSigned.parameter.jill_order_gateway_sig='f'.repeat(64);
assert.equal(list(guestSigned).ok,false,'Forged HMAC denied');
const before=ownerSheet().rows.length;
box.JILL_CUSTOM_ORDER_SANDBOX=false;
assert.throws(()=>bind('jill:qa:disabled',gidA,raw1,false),/WORK QA only/);
assert.equal(list(requestA).ok,false);
box.JILL_REWARDS_RUNTIME='LIVE';box.JILL_CUSTOM_ORDER_SANDBOX=true;
assert.throws(()=>bind('jill:qa:disabled',gidA,raw1,false),/WORK QA only/);
assert.equal(list(requestA).ok,false,'No LIVE account reads enabled by QA code');
assert.equal(ownerSheet().rows.length,before);
console.log('WORK Google canonical owner ledger guest replay prevention, HMAC-only scoped list, customer A/B denial and private projection tests passed.');
