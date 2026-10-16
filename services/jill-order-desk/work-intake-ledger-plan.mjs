// JILL WORK Phase 26 — SOURCE-ONLY prototype for idempotent intake.
// This pure planner performs NO D1/network work, Worker route, Shopify
// authentication, Google HMAC verification, queue submit, or HTTP ACK.
// Never use with LIVE/KEEP, real customer data or real remote D1.
// Authenticated app-proxy input must be established by a future adapter;
// setting a flag or passing a shop value cannot authenticate a caller.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {validateCustomOrderPayload}
  from '../../backend/custom-order-gateway.mjs';
const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const OWNER=/^(?:|gid:\/\/shopify\/Customer\/[1-9][0-9]*)$/;
const HEX=/^[0-9a-f]{64}$/;
const FAIL=()=>{throw Error('jill_work_intake_ledger_not_authorized');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,expected)=>object(x)&&
  Object.keys(x).length===expected.length&&expected.every(k=>
    Object.hasOwn(x,k));
const integer=x=>Number.isSafeInteger(x)&&x>0;
const hash=(key,text)=>createHmac('sha256',key)
  .update(text,'utf8').digest('hex');
function localFields(data){
  const expected=['shop','submissionId','formBody','ownerGid',
    'macKey','nowMs'];
  if(!keys(data,expected)||data.shop!==SHOP||
     typeof data.submissionId!=='string'||!ID.test(data.submissionId)||
     typeof data.formBody!=='string'||
     typeof data.ownerGid!=='string'||!OWNER.test(data.ownerGid)||
     typeof data.macKey!=='string'||data.macKey.length<32||
     !integer(data.nowMs))FAIL();
  let submitted;
  try{submitted=validateCustomOrderPayload(data.formBody);}
  catch{FAIL();}
  if(submitted.id!==data.submissionId)FAIL();
  // MAC includes the TRUSTED owner identity (not a form field), and
  // the exact validated form body. No raw payload/owner is persisted.
  const payloadMac=hash(data.macKey,'JILL-WORK-INTAKE-V1\n'+
    data.shop+'\n'+data.submissionId+'\n'+data.ownerGid+'\n'+
    data.formBody);
  const ownerMac=hash(data.macKey,'JILL-WORK-OWNER-V1\n'+
    data.shop+'\n'+data.submissionId+'\n'+data.ownerGid);
  return {payloadMac,ownerMac};
}
function failSafe(plan){
  return Object.freeze({
    ...plan,
    production_ready:false,
    independently_authenticated:false,
    customer_ack_authorized:false,
    retry_dispatch_authorized:false,
    backend_receipt_confirmed:false,
    paid_order_confirmed:false,
    queue_delivery_authorized:false,
    remote_migration_authorized:false,
    deployment_authorized:false,
    mutation_executed:false,
  });
}
/**
 * A unique shop/submission_id row is inserted at most once. The
 * INSERT RETURNING result alone is NOT a customer receipt.
 * Only the real Google QA signed confirmation can authorize the
 * existing customer-facing received status (not this ledger).
 */
export function planLocalWorkIntakeReserve(input){
  const {payloadMac,ownerMac}=localFields(input);
  return failSafe({
    kind:'local_intake_reservation_plan',
    sql:'INSERT INTO jill_work_intake_ledger '+
      '(shop,submission_id,payload_mac,owner_binding_mac,'+
      'state,dispatch_attempts,created_at_ms,updated_at_ms) '+
      "VALUES (?,?,?,?,'reserved',0,?,?) "+
      'ON CONFLICT(shop,submission_id) DO NOTHING '+
      'RETURNING state,dispatch_attempts,updated_at_ms',
    params:Object.freeze([
      SHOP,input.submissionId,payloadMac,ownerMac,
      input.nowMs,input.nowMs,
    ]),
    lookupSql:'SELECT payload_mac,owner_binding_mac,state,'+
      'dispatch_attempts,updated_at_ms '+
      'FROM jill_work_intake_ledger WHERE shop=? AND submission_id=?',
    lookupParams:Object.freeze([SHOP,input.submissionId]),
    identity_mac:payloadMac,
    owner_mac:ownerMac,
  });
}
/**
 * Never claim an existing ID is the same request until BOTH MACs
 * match in constant time. Even a matching 'confirmed' row is not
 * a customer-facing receipt without independent Google confirmation.
 */
export function inspectLocalWorkIntakeExisting({plan,row}={}){
  if(plan?.kind!=='local_intake_reservation_plan'||
     !keys(row,['payload_mac','owner_binding_mac','state',
       'dispatch_attempts','updated_at_ms'])||
     !HEX.test(row.payload_mac)||!HEX.test(row.owner_binding_mac)||
     !integer(row.updated_at_ms)||
     !['reserved','forwarding','ambiguous','confirmed'].includes(row.state)||
     ![0,1].includes(row.dispatch_attempts))FAIL();
  const same=(a,b)=>HEX.test(a)&&HEX.test(b)&&
    timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
  if(!same(plan.identity_mac,row.payload_mac)||
     !same(plan.owner_mac,row.owner_binding_mac))
    return failSafe({kind:'payload_or_owner_conflict',
      outcome:'deny_conflicting_duplicate'});
  return failSafe({kind:'matching_existing_local_row',
    outcome:row.state==='confirmed'?'independent_google_receipt_required':
      'unconfirmed_or_ambiguous_no_ack',
    dispatch_attempts:row.dispatch_attempts});
}
function transition(row,input,from,to,attempts){
  const expected=['shop','submissionId','payloadMac',
    'ownerMac','priorUpdatedAtMs','nowMs'];
  if(!keys(input,expected)||input.shop!==SHOP||
     !ID.test(input.submissionId||'')||
     !HEX.test(input.payloadMac||'')||
     !HEX.test(input.ownerMac||'')||
     !integer(input.priorUpdatedAtMs)||!integer(input.nowMs)||
     input.nowMs<=input.priorUpdatedAtMs||
     !['reserved','forwarding','ambiguous'].includes(from)||
     !['forwarding','ambiguous','confirmed'].includes(to))FAIL();
  return failSafe({
    kind:'local_intake_'+to+'_transition_plan',
    sql:'UPDATE jill_work_intake_ledger '+
      'SET state=?,dispatch_attempts=?,updated_at_ms=? '+
      'WHERE shop=? AND submission_id=? AND payload_mac=? '+
      'AND owner_binding_mac=? AND state=? '+
      'AND dispatch_attempts=? AND updated_at_ms=? '+
      'RETURNING state,dispatch_attempts,updated_at_ms',
    params:Object.freeze([
      to,attempts.to,input.nowMs,SHOP,input.submissionId,
      input.payloadMac,input.ownerMac,from,attempts.from,
      input.priorUpdatedAtMs,
    ]),
  });
}
export function planLocalWorkIntakeClaimFirstDispatch(input){
  return transition(null,input,'reserved','forwarding',
    {from:0,to:1});
}
export function planLocalWorkIntakeUncertain(input){
  return transition(null,input,'forwarding','ambiguous',
    {from:1,to:1});
}
/**
 * This models ONE local transition after a separately verified Google
 * signed receipt. It requires a literal SYNTHETIC evidence marker and
 * must NOT be reused by a production endpoint. This function cannot
 * cryptographically verify Google's response or Shopify customer
 * ownership and always denies customer acknowledgement.
 */
export function planLocalWorkIntakeSyntheticConfirmation({
  input,from,evidenceMarker,
}={}){
  if(evidenceMarker!=='synthetic_local_only_google_receipt'||
     !['forwarding','ambiguous'].includes(from))FAIL();
  return transition(null,input,from,'confirmed',{from:1,to:1});
}
