import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise ACTUAL QA-only outbox logic. No Google, email, Shopify or network calls.
const source=readFileSync(
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const start=source.indexOf('/* WORK HQ MERCHANT COMMAND V1');
const end=source.indexOf('/* END WORK HQ MERCHANT COMMAND V1 */',start);
assert.ok(start>0&&end>start);
const script=source.slice(start,end);
const op='jill:hq:09e67134-cd3e-47d4-b371-555a121b5f99';
const id='jill:92b32355-900e-47ba-8946-ccd93190a3b7';
const email='test.customer@example.invalid';
const note='Your custom request is being reviewed.';
const HEADERS=['submission_id','email','raw_payload'];
const EVENTS=['event_id','submission_id','revision','customer_status',
  'internal_status','public_note','internal_note','evidence_ref','actor',
  'occurred_at','source'];
const data={
  Submissions:[HEADERS,[id,email,JSON.stringify({customer:{email}})]],
  CustomOrderEvents:[EVENTS,[op,id,2,'received','new',note,'','','',
    '2026-10-15T12:00:00Z','merchant']],
};
function sheet(name) {
  return {
    getLastRow(){return data[name].length;},
    getRange(start,col,count=1,width=1) {
      return {
        getValues:()=>data[name].slice(start-1,start-1+count)
          .map(row=>row.slice(col-1,col-1+width)),
        setValues:rows=>{
          rows.forEach((row,i)=>{data[name][start+i-1]=row;});
        },
      };
    },
    appendRow(row){data[name].push([...row]);},
    setFrozenRows(){},
  };
}
let held=false;
const ctx={
  JILL:{SHEET_ID:'QA_TEST_SHEET',SHEET_NAME:'Submissions'},
  HEADERS,JILL_CUSTOM_WORKFLOW:{EVENTS_SHEET:'CustomOrderEvents',
    HEADERS:EVENTS},
  SpreadsheetApp:{
    openById:key=>{
      assert.equal(key,'QA_TEST_SHEET');
      return {
        getSheetByName:name=>data[name]?sheet(name):null,
        insertSheet:name=>{data[name]=[];return sheet(name);},
      };
    },
    flush(){},
  },
  LockService:{getScriptLock:()=>({
    waitLock:()=>{assert.equal(held,false);held=true;},
    releaseLock:()=>{assert.equal(held,true);held=false;},
  })},
  jillWorkHqReadOnlySheet_:(ss,name,expected)=>{
    const found=ss.getSheetByName(name);
    assert.deepEqual(found.getRange(1,1,1,expected.length).getValues()[0],expected);
    return found;
  },
  jillCustomOrderEventsFor_:(events,forId)=>{
    assert.equal(forId,id);
    return data.CustomOrderEvents.slice(1).filter(row=>row[1]===forId)
      .map(row=>({event_id:row[0],revision:row[2],public_note:row[5]}));
  },
  Date,JSON,Math,String,Number,Array,Object,Error,console,
};
vm.createContext(ctx);
vm.runInContext(script,ctx);
const command={operation_id:op,submission_id:id,public_note:note};
assert.equal(ctx.jillWorkHqQueueEmail_(command,2),'queued');
assert.equal(held,false);
assert.equal(data.CustomOrderMailOutbox.length,2);
const queued=data.CustomOrderMailOutbox[1];
assert.equal(queued[0],op);
assert.equal(queued[1],id);
assert.equal(queued[2],2);
assert.equal(queued[3],email);
assert.equal(queued[5],note);
assert.equal(queued[6],'QUEUED');
assert.equal(ctx.jillWorkHqQueueEmail_(command,2),'queued');
assert.equal(data.CustomOrderMailOutbox.length,2,
  'same event may never create duplicate email');
assert.throws(()=>ctx.jillWorkHqQueueEmail_(
  {...command,public_note:'Modified message'},2));
assert.equal(data.CustomOrderMailOutbox.length,2);
data.CustomOrderMailOutbox[1][3]='changed@example.invalid';
assert.throws(()=>ctx.jillWorkHqQueueEmail_(command,2),/conflict/);
data.CustomOrderMailOutbox[1][3]=email;
data.Submissions[1][1]='attacker@example.invalid';
assert.throws(()=>ctx.jillWorkHqQueueEmail_(command,2),/integrity/);
data.Submissions[1][1]=email;
assert.equal(held,false);
assert.doesNotMatch(script,/MailApp\.|GmailApp\.|sendEmail\(/);
console.log('PASS WORK QA email outbox: original recipient verification, event reference, queued-only, duplicate idempotency, tamper denial, lock release, no email send.');
