import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHmac} from 'node:crypto';
import {
  makeNonMutatingProbe,probeWorkHqQaWriteKey,assertNonMutatingQaHandler,
} from './probe-work-hq-qa-write-key.mjs';
const qa=readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
assert.equal(assertNonMutatingQaHandler(qa),true);
assert.throws(()=>assertNonMutatingQaHandler(qa.replace(
  "!['status','message'].includes(kind)",'false')),/uncertified/);

const secret='WORK_TEST_KEY_NO_PRODUCTION_abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK';
const stamp=String(Date.now());
const uuid='09e67134-cd3e-47d4-b371-555a121b5f99';
const nonce='N'.repeat(32);
const params=makeNonMutatingProbe({
  secret,now:()=>Number(stamp),makeUuid:()=>uuid,makeNonce:()=>nonce,
});
assert.equal(params.get('kind'),'diagnostic');
assert.equal(params.get('public_note'),'');
assert.equal(params.get('internal_note'),'');
assert.equal(params.get('handoff_reference'),'');
assert.equal(params.get('operation_id'),'jill:hq:status:'+uuid);
assert.equal(params.get('jill_order_merchant_command'),'1');
const begin=qa.indexOf('/* WORK HQ MERCHANT COMMAND V1');
const end=qa.indexOf('/* END WORK HQ MERCHANT COMMAND V1 */',begin);
assert.ok(begin>=0&&end>begin);
let writes=0,email=0;
const ctx={
  JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
  PropertiesService:{getScriptProperties:()=>({
    getProperty:name=>name==='JILL_HQ_MERCHANT_WRITE_SECRET'?secret:null,
  })},
  Utilities:{computeHmacSha256Signature:(message,key)=>
    Array.from(createHmac('sha256',key).update(message).digest()).map(
      v=>v>127?v-256:v)},
  constantTimeEqual_:(a,b)=>a===b,
  JILL_CUSTOM_WORKFLOW:{STATUSES:['received','reviewing','completed'],
    INTERNAL:['new','needs_quote']},
  jillCustomOrderMerchantUpdateAsActor_:()=>{writes++;throw Error('wrong');},
  jillWorkHqQueueEmail_:()=>{email++;throw Error('wrong');},
  json_:value=>value,
  Date,Math,Array,Number,String,Object,JSON,Error,
};
vm.createContext(ctx);
vm.runInContext(qa.slice(begin,end),ctx);
const form=Object.fromEntries(params);
const event={parameter:form,parameters:Object.fromEntries(
  Object.entries(form).map(([key,value])=>[key,[value]]))};
assert.equal(ctx.jillWorkHqMerchantCommandVerified_(event),true);
const rejected=ctx.jillWorkHqMerchantCommand_(event);
assert.equal(rejected.ok,false);
assert.equal(rejected.error.code,'invalid_command');
assert.equal(writes,0);
assert.equal(email,0);
const unauthorized=ctx.jillWorkHqMerchantCommand_({
  ...event,parameter:{...form,jill_hq_write_sig:'0'.repeat(64)}
});
assert.equal(unauthorized.error.code,'unauthorized');
const mock=async(url,req)=>{
  assert.ok(url.includes('AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz'));
  assert.equal(req.method,'POST');
  const p=Object.fromEntries(new URLSearchParams(req.body));
  const e={parameter:p,parameters:Object.fromEntries(
    Object.entries(p).map(([k,v])=>[k,[v]]))};
  return Response.json(ctx.jillWorkHqMerchantCommand_(e));
};
const result=await probeWorkHqQaWriteKey({
  secret,backendFetch:mock,now:()=>Number(stamp),
  makeUuid:()=>uuid,makeNonce:()=>nonce,
});
assert.equal(result.matched,true);
assert.equal(result.mutated,false);
assert.equal(writes,0);
assert.equal(email,0);
const mismatch=await probeWorkHqQaWriteKey({
  secret:'X'.repeat(64),backendFetch:mock,
  now:()=>Number(stamp),makeUuid:()=>uuid,makeNonce:()=>nonce,
});
assert.equal(mismatch.matched,false);
assert.equal(mismatch.mutated,false);
assert.equal(writes,0);
await assert.rejects(()=>probeWorkHqQaWriteKey({
  secret,backendFetch:async()=>Response.json({error:'unknown'}),
}),/unrecognized/);
console.log('PASS signed WORK QA handshake: real Google verifier accepts matching local HMAC then rejects diagnostic BEFORE canonical writer/outbox; mismatch denied, no mutation.');
