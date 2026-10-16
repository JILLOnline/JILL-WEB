// WORK PHASE 20 — LOCAL TEST-ONLY recovery observation, never production.
// No Worker route, provider access, D1 access, storage writes or secrets.
// Only applies to already-committed synthetic object intents. A real
// recovery workflow requires authenticated Owner, exact D1 state, fresh
// account/bucket attestation and independent trusted R2 evidence.
// This function does NOT establish trusted provider provenance.
import {createHash,timingSafeEqual} from 'node:crypto';
const DENY=()=>{throw Error('work_r2_recovery_observation_not_authorized');};
const SHOP='jill-work.myshopify.com';
const HEX=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function same(a,b){
  return typeof a==='string'&&typeof b==='string'&&
    HEX.test(a)&&HEX.test(b)&&
    timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
const bytes=x=>Buffer.isBuffer(x)||x instanceof Uint8Array;
const SQL=[
  'UPDATE jill_work_r2_object_intents',
  'SET state=?,updated_at_ms=?',
  'WHERE shop=? AND submission_id=? AND scope=? AND item_key=?',
  'AND reference_index=? AND reservation_id=? AND object_key=?',
  'AND content_sha256=? AND byte_length=?',
  "AND state='reserved' AND updated_at_ms=?",
  'RETURNING state,updated_at_ms',
].join(' ');

/**
 * Propose a synthetic D1 transition, never execute it here.
 * A failed/missing R2 read is ambiguous, NOT evidence of "no object":
 * the write might have completed before a network timeout.
 * Only exact local HEAD metadata plus full byte hash permits the
 * quarantined_unlinked CANDIDATE, still no delivery or preview.
 */
export function planWorkR2LocalRecoveryObservation({
  intent,head,storedBytes,nowMs,
}={}){
  if(!object(intent)||intent.shop!==SHOP||
     typeof intent.submission_id!=='string'||
     !['request','item'].includes(intent.scope)||
     typeof intent.item_key!=='string'||
     !Number.isSafeInteger(intent.reference_index)||
     intent.reference_index<0||intent.reference_index>19||
     intent.state!=='reserved'||
     !UUID.test(intent.reservation_id||'')||
     intent.object_key!=='work/quarantine/v1/'+intent.reservation_id||
     !HEX.test(intent.reference_mac||'')||
     !HEX.test(intent.content_sha256||'')||
     !Number.isSafeInteger(intent.byte_length)||
     intent.byte_length<20||intent.byte_length>8*1024*1024||
     !Number.isSafeInteger(intent.updated_at_ms)||
     intent.updated_at_ms<1||
     !Number.isSafeInteger(nowMs)||nowMs<=intent.updated_at_ms)
    DENY();

  let matched=false;
  if(object(head)&&bytes(storedBytes)){
    const input=Buffer.from(storedBytes);
    matched=head.key===intent.object_key&&
      head.size===intent.byte_length&&
      input.length===intent.byte_length&&
      same(createHash('sha256').update(input).digest('hex'),
        intent.content_sha256)&&
      head.httpMetadata?.contentType==='application/octet-stream'&&
      head.httpMetadata?.cacheControl==='private, no-store'&&
      head.httpMetadata?.contentDisposition==='attachment'&&
      head.customMetadata?.work_stage==='quarantine_v1'&&
      same(head.customMetadata?.sha256,intent.content_sha256)&&
      same(head.customMetadata?.reference_mac,intent.reference_mac);
  }
  const target=matched?'quarantined_unlinked':'ambiguous';
  // Existing 0006 proposal allows ONLY reserved -> target. A manual
  // review may later revoke either state, never retry/refund/rebind.
  return Object.freeze({
    source:'synthetic_local_recovery_candidate_not_provider_proof',
    recommendation:target,
    reason:matched?'local_full_readback_matches':
      'local_readback_missing_incomplete_or_mismatched',
    statement:Object.freeze({
      sql:SQL,
      params:Object.freeze([
        target,nowMs,intent.shop,intent.submission_id,intent.scope,
        intent.item_key,intent.reference_index,intent.reservation_id,
        intent.object_key,intent.content_sha256,intent.byte_length,
        intent.updated_at_ms,
      ]),
    }),
    executes_remotely:false,
    provider_authenticated:false,
    upload_authorized:false,
    preview_enabled:false,
    auto_retry:false,
    auto_delete:false,
    quota_refund:false,
    remote_migration_authorized:false,
  });
}
