import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the ACTUAL Apps Script workflow source against an in-memory sheet.
// No mirror rules and no Shopify/Google network calls in this harness.
const source=fs.readFileSync(
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8'
).replace(/\r\n?/g,'\n');
const begin=source.indexOf('const JILL_CUSTOM_WORKFLOW = Object.freeze(');
const end=source.indexOf('/* END CUSTOM ORDER WORKFLOW V1 */',begin);
assert.ok(begin>0&&end>begin,'Canonical workflow domain must exist');
const domain=source.slice(begin,end);
assert.match(source,/jillCustomOrderEnsureReceived_\(submissionId, data\.submitted_at\)/);
const sourceFields=['submission_id','status','submitted_at'];
const sourceRows=[sourceFields,['jill:QA-ORDER-1','RECEIVED','2026-10-11T13:00:00Z']];
const eventRows=[];
class Range {
  constructor(sheet,start,col,count,span){Object.assign(this,{sheet,start,col,count,span});}
  getValues(){return Array.from({length:this.count},(_,i)=>
    Array.from({length:this.span},(_,j)=>this.sheet.rows[this.start+i-1]?.[this.col+j-1]??''));}
  getValue(){return this.sheet.rows[this.start-1]?.[this.col-1]??'';}
  setDataValidation(){return this;}
  setValues(values){values.forEach((row,i)=>row.forEach((v,j)=>{
    const target=this.start+i-1;
    while(this.sheet.rows.length<=target)this.sheet.rows.push([]);
    this.sheet.rows[target][this.col+j-1]=v;
  }));}
}
class Sheet {
  constructor(rows){this.rows=rows;}
  getLastRow(){return this.rows.length;}
  getRange(start,col,count=1,span=1){
    if(typeof start==='string')return {setDataValidation:()=>{}};
    return new Range(this,start,col,count,span);
  }
  getName(){return Object.entries(sheets).find(([,value])=>value===this)?.[0]||'';}
  setFrozenRows(){return this;}
  appendRow(row){this.rows.push([...row]);}
}
const original=new Sheet(sourceRows);
const sheets={Submissions:original};
const spreadsheet={
  getSheetByName:name=>sheets[name]||null,
  insertSheet:name=>(sheets[name]=new Sheet([])),
};
let actor='staff@jill.example',allowed='staff@jill.example',runtime='LIVE',locks=0;
const sandbox={
  SpreadsheetApp:{openById:id=>{assert.equal(id,'QA-SHEET');return spreadsheet;},flush(){},
    newDataValidation:()=>({requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return {};}})},
  Session:{getActiveUser:()=>({getEmail:()=>actor})},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>allowed})},
  LockService:{getScriptLock:()=>({
    waitLock:()=>{if(locks)throw Error('Concurrent update');locks++;},
    releaseLock:()=>{locks--;}
  })},
  JILL:{SHEET_ID:'QA-SHEET',SHEET_NAME:'Submissions'},
  HEADERS:sourceFields,
  getSheet_:()=>original,
  findSubmissionRow_:(sheet,id)=>sheet.rows.findIndex((row,i)=>i>0&&row[0]===id)+1,
  get JILL_REWARDS_RUNTIME(){return runtime;},
  Date,JSON,Number,String,Math,Array,Object,Error,isNaN,console
};
vm.createContext(sandbox);
vm.runInContext(domain,sandbox,{filename:'JILL_Custom_Order_Workflow.gs'});
const create=sandbox.jillCustomOrderEnsureReceived_;
const read=sandbox.jillCustomOrderMerchantRead;
const update=sandbox.jillCustomOrderMerchantUpdate;
const backfill=sandbox.jillCustomOrderMerchantBackfill;
const setupDesk=sandbox.jillCustomOrderMerchantSetupDesk;
const processDesk=sandbox.jillCustomOrderMerchantProcessDesk;
const js=(x)=>JSON.parse(JSON.stringify(x));
let event=create('jill:QA-ORDER-1','2026-10-11T13:00:00Z');
assert.equal(event.revision,1);
assert.equal(event.customer_status,'received');
assert.equal(event.actor,'system:intake');
assert.equal(create('jill:QA-ORDER-1','2026-10-11T13:00:00Z').revision,1);
assert.equal(sheets.CustomOrderEvents.rows.length,2,'retry must not duplicate receipt');
assert.equal(read('jill:QA-ORDER-1').revision,1);

const request={
  submission_id:'jill:QA-ORDER-1',
  operation_id:'jill:op-00001',
  expected_revision:1,
  customer_status:'reviewing',
  internal_status:'needs_quote',
  public_note:'We are reviewing your request.',
  internal_note:'Check paper stock.',
};
assert.deepEqual(js(update(request)),{
  ok:true,duplicate:false,revision:2,customer_status:'reviewing',
});
assert.equal(update(request).duplicate,true,'retry is idempotent');
assert.equal(sheets.CustomOrderEvents.rows.length,3);
assert.equal(read('jill:QA-ORDER-1').history[1].internal_note,'Check paper stock.');
assert.throws(()=>update({...request,public_note:'Changed'}),/Idempotency key/);
assert.throws(()=>update({...request,operation_id:'jill:op-00002'}),/reload current revision/);
assert.throws(()=>update({...request,operation_id:'jill:op-00003',
  expected_revision:2,customer_status:'completed',handoff_reference:'QA-handoff'}),/Invalid Custom Order status transition/);
assert.throws(()=>update({...request,operation_id:'jill:op-00003',
  expected_revision:2,customer_status:'awaiting_approval',public_note:'x'.repeat(501)}),/Invalid Custom Order update/);
assert.throws(()=>update({...request,operation_id:'jill:op-00004',
  expected_revision:2,customer_status:'awaiting_approval',internal_status:'fake-payment'}),/Invalid Custom Order update/);
assert.equal(update({...request,operation_id:'jill:op-00005',
  expected_revision:2,customer_status:'awaiting_approval',internal_status:'waiting_customer'}).revision,3);
assert.throws(()=>update({...request,operation_id:'jill:op-00006',
  expected_revision:3,customer_status:'in_production'}),/Invalid Custom Order status transition/);
assert.equal(update({...request,operation_id:'jill:op-00007',expected_revision:3,
  customer_status:'reviewing'}).revision,4);
assert.equal(update({...request,operation_id:'jill:op-00008',expected_revision:4,
  customer_status:'in_production'}).revision,5);
assert.equal(update({...request,operation_id:'jill:op-00009',expected_revision:5,
  customer_status:'ready_pickup'}).revision,6);
assert.throws(()=>update({...request,operation_id:'jill:op-00010',expected_revision:6,
  customer_status:'completed',handoff_reference:''}),/handoff reference/);
assert.equal(update({...request,operation_id:'jill:op-00011',expected_revision:6,
  customer_status:'completed',handoff_reference:'Signed pickup receipt'}).revision,7);
assert.throws(()=>update({...request,operation_id:'jill:op-00012',expected_revision:7,
  customer_status:'reviewing'}),/Invalid Custom Order status transition/);
assert.equal(locks,0,'all update attempts must release lock');
actor='unauthorized@example.invalid';
assert.throws(()=>read('jill:QA-ORDER-1'),/not authorized/);
assert.throws(()=>update(request),/not authorized/);
actor='';
assert.throws(()=>read('jill:QA-ORDER-1'),/not authorized/);
actor='staff@jill.example';allowed='';
assert.throws(()=>update(request),/not authorized/);
allowed='staff@jill.example';
runtime='WORK';
assert.throws(()=>create('jill:QA-ORDER-1','2026-10-11T13:00:00Z'),/disabled/);
assert.throws(()=>read('jill:QA-ORDER-1'),/disabled/);
runtime='LIVE';
assert.throws(()=>update({...request,operation_id:'jill:op-00013',
  submission_id:'jill:missing',expected_revision:1}),/does not exist/);
assert.equal(locks,0);

sheets.CustomOrderEvents.rows[3][2]=999;
assert.throws(()=>read('jill:QA-ORDER-1'),/inconsistent/);
sheets.CustomOrderEvents.rows[3][2]=3;
assert.equal(read('jill:QA-ORDER-1').revision,7);
assert.deepEqual(js(backfill(0,3)),{scanned:1,created:0,next_offset:null});
assert.deepEqual(js(backfill(1,3)),{scanned:0,created:0,next_offset:null});
assert.throws(()=>backfill(-1,2),/nonnegative row offset/);
assert.equal(sheets.CustomOrderEvents.rows.length,8);

// Authorized spreadsheet controls, no public status endpoint or timed worker.
const setup=setupDesk();
assert.equal(setup.ok,true);
assert.equal(setup.sheet,'CustomOrderDesk');
const desk=sheets.CustomOrderDesk;
assert.equal(desk.getLastRow(),1);
desk.appendRow([
  'jill:desk-00001','jill:QA-ORDER-1',7,'reviewing','','Attempt to reopen','','','','',
]);
const rejected=processDesk();
assert.deepEqual(js(rejected),{processed:1,succeeded:0,rejected:1});
assert.match(String(desk.rows[1][8]),/^REJECTED:/);
assert.equal(read('jill:QA-ORDER-1').revision,7);
sourceRows.push(['jill:QA-ORDER-2','RECEIVED','2026-10-11T13:02:00Z']);
create('jill:QA-ORDER-2','2026-10-11T13:02:00Z');
desk.appendRow([
  'jill:desk-00002','jill:QA-ORDER-2',1,'reviewing','needs_quote',
  'We have your request.','Check inventory.','','','',
]);
const applied=processDesk();
assert.deepEqual(js(applied),{processed:1,succeeded:1,rejected:0});
assert.match(String(desk.rows[2][8]),/^APPLIED revision 2$/);
assert.equal(read('jill:QA-ORDER-2').revision,2);
desk.rows[2][8]='';
const retry=processDesk();
assert.deepEqual(js(retry),{processed:1,succeeded:1,rejected:0});
assert.equal(read('jill:QA-ORDER-2').revision,2);
assert.equal(locks,0,'command processor must release every lock');

console.log('Custom Order backend event log, merchant ACL, CAS, idempotency, transitions and isolation passed.');
