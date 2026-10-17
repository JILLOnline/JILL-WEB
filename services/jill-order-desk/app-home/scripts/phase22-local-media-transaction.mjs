// Phase 22 WORK MEDIA — SYNTHETIC LOCAL transaction demonstration only.
// This file lives below app-home/scripts/ and MUST NOT be imported by
// deployed routes. Its only storage target is a harness-verified
// remote:false fake D1/R2 binding. Never call with real account bindings.
// No payment/billing authorization, previews, delete, retry, or download.
import {createHash,timingSafeEqual} from 'node:crypto';
import {readWorkMerchantPermission}
  from '../../merchant-access.mjs';
import {chooseWorkOwnerReference}
  from '../../work-private-media-intent.mjs';
import {draftWorkMediaRegistryBinding}
  from '../../work-private-media-registry.mjs';
import {planWorkR2AtomicIntentBatch,
  inspectWorkR2AtomicBatchReceipt}
  from '../../work-private-r2-d1-batch-plan.mjs';
import {planWorkR2LocalRecoveryObservation}
  from '../../work-private-r2-local-recovery.mjs';
import {inspectEdgeImageHeader,EDGE_LIMITS}
  from '../../../../tools/work-media-edge/sanitize.mjs';

const SHOP='jill-work.myshopify.com';
const MARKER='phase22-local-synthetic-runner';
const FAKE_DB='00000000-0000-4000-8000-000000000019';
const FAKE_R2='jill-phase19-local-synthetic-artwork';
const SAFE_CLASSES=new Set(['Standard','']); // local emulator can report ''
const SHA=/^[0-9a-f]{64}$/;
const denial=()=>{throw Error('phase22_local_media_denied');};
const digest=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&
  SHA.test(a)&&SHA.test(b)&&
  timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const bytes=b=>Buffer.isBuffer(b)||b instanceof Uint8Array;
const respond=(code,stage)=>Object.freeze({
  ok:false,code,stage,
  preview_enabled:false,upload_authorized:false,
  auto_retry:false,auto_delete:false,quota_refund:false,
  provider_authenticated:false,billing_guaranteed:false,
});
function localOnly(environment,db,r2){
  // Prevent accidental callers from passing normal Worker env bindings.
  // This is test-only verification, NOT cryptographic proof of provenance.
  if(!environment||environment.marker!==MARKER||
     environment.database_id!==FAKE_DB||
     environment.bucket_name!==FAKE_R2||
     environment.remote!==false||
     environment.workers_dev!==false||
     environment.name!=='jill-work-phase19-local-media-only'||
     !db||typeof db.prepare!=='function'||typeof db.batch!=='function'||
     !r2||typeof r2.put!=='function'||typeof r2.head!=='function'||
     typeof r2.get!=='function')denial();
}
function snapshotOk(snapshot,nowMs,size){
  // Synthetic stand-in for missing authoritative provider billing gate.
  // Its source label is explicitly UNTRUSTED for production.
  return snapshot?.source==='synthetic_local_phase22_snapshot_only'&&
    snapshot.storage_class==='Standard'&&
    snapshot.public_dev_url_enabled===false&&
    snapshot.custom_domain_count===0&&
    snapshot.emulated_only===true&&
    Number.isSafeInteger(snapshot.checked_at_ms)&&
    nowMs>=snapshot.checked_at_ms&&
    nowMs-snapshot.checked_at_ms<=300000&&
    Number.isSafeInteger(snapshot.account_bytes)&&
    snapshot.account_bytes>=0&&
    snapshot.account_bytes+size<=512*1024*1024&&
    Number.isSafeInteger(snapshot.class_a_month)&&
    snapshot.class_a_month>=0&&snapshot.class_a_month<10000&&
    Number.isSafeInteger(snapshot.class_b_month)&&
    snapshot.class_b_month>=0&&snapshot.class_b_month<20000;
}
function assertMetadataFreeWebp(encoded){
  // Independent transaction-level defense: never trust a codec's
  // x-jill-sanitized header alone. Reject forbidden RIFF chunks after
  // reading the decoded WebP structure (including VP8X extras).
  if(encoded.length<20||encoded.toString('ascii',0,4)!=='RIFF'||
     encoded.toString('ascii',8,12)!=='WEBP'||
     encoded.readUInt32LE(4)+8!==encoded.length)denial();
  let offset=12,frames=0;
  while(offset+8<=encoded.length){
    const name=encoded.toString('ascii',offset,offset+4);
    const length=encoded.readUInt32LE(offset+4);
    const start=offset+8;
    if(start+length>encoded.length)denial();
    if(['EXIF','XMP ','ICCP','ANIM','ANMF'].includes(name))denial();
    if(name==='VP8 '||name==='VP8L')frames++;
    offset=start+length+(length&1);
  }
  if(offset!==encoded.length||frames!==1)denial();
}

async function codecSanitize(fetchCodec,mime,input){
  const validMime=new Set(['image/png','image/jpeg','image/webp']);
  if(!validMime.has(mime)||!bytes(input)||
     input.length<20||input.length>EDGE_LIMITS.maxInputBytes)denial();
  inspectEdgeImageHeader(new Uint8Array(input),mime);
  const response=await fetchCodec(mime,new Uint8Array(input));
  if(!response||response.status!==200||
     response.headers.get('content-type')!=='image/webp'||
     response.headers.get('x-jill-sanitized')!=='true'||
     response.headers.get('x-jill-persisted')!=='false'||
     response.headers.get('x-jill-source-type')!==mime)denial();
  const declared=Number(response.headers.get('content-length'));
  if(Number.isFinite(declared)&&declared>EDGE_LIMITS.maxOutputBytes)
    denial();
  if(!response.body)denial();
  const reader=response.body.getReader();
  const parts=[];let count=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))denial();
      count+=value.length;
      if(count>EDGE_LIMITS.maxOutputBytes)denial();
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  const encoded=new Uint8Array(count);let i=0;
  for(const part of parts){encoded.set(part,i);i+=part.length;}
  const hdr=inspectEdgeImageHeader(encoded,'image/webp');
  assertMetadataFreeWebp(Buffer.from(encoded));
  if(String(hdr.width)!==response.headers.get('x-jill-width')||
     String(hdr.height)!==response.headers.get('x-jill-height'))
    denial();
  return Buffer.from(encoded);
}
async function registryPending(db,detail,submissionId,selector,registryKey,nowMs){
  const row=draftWorkMediaRegistryBinding({
    detail,submissionId,selector,registryKey,
  });
  await db.prepare(
    'INSERT INTO jill_work_private_media_registry '+
    '(shop,submission_id,scope,item_key,reference_index,reference_mac,'+
    'status,created_at_ms,updated_at_ms) VALUES (?,?,?,?,?,?,?,?,?) '+
    'ON CONFLICT(shop,submission_id,scope,item_key,reference_index) DO NOTHING'
  ).bind(row.shop,row.submission_id,row.scope,row.item_id??'',
    row.reference_index,row.reference_mac,
    'pending_verification',nowMs,nowMs).run();
  const stored=await db.prepare(
    'SELECT reference_mac,status FROM jill_work_private_media_registry '+
    'WHERE shop=? AND submission_id=? AND scope=? AND item_key=? '+
    'AND reference_index=?'
  ).bind(row.shop,row.submission_id,row.scope,row.item_id??'',
    row.reference_index).first();
  if(stored?.status!=='pending_verification'||
     !same(stored?.reference_mac,row.reference_mac))denial();
}
async function reconcileOnce(db,r2,intent,nowMs){
  // No second PUT on exception or ACK-loss. An absent HEAD/GET is
  // ambiguous, not a reason to retry or refund reserved operations.
  let head=null,data;
  try{
    head=await r2.head(intent.object_key);
    if(head?.key===intent.object_key&&
       Number.isSafeInteger(head.size)&&
       head.size===intent.byte_length&&
       SAFE_CLASSES.has(head.storageClass||'')){
      const obj=await r2.get(intent.object_key);
      if(obj && obj.size===intent.byte_length){
        const b=Buffer.from(await obj.arrayBuffer());
        if(b.length===intent.byte_length)data=b;
      }
    }
  }catch{head=null;data=undefined;}
  const result=planWorkR2LocalRecoveryObservation({
    intent,head,storedBytes:data,nowMs,
  });
  const receipt=await db.prepare(result.statement.sql)
    .bind(...result.statement.params).all();
  if(receipt?.success!==true||receipt.results?.length!==1||
     receipt.results[0].state!==result.recommendation)
    return respond('local_commit_unconfirmed','reconciliation');
  return respond(result.recommendation,'terminal_local_only');
}

/**
 * LOCAL SYNTHETIC integration only. Caller must pin fake Wrangler config
 * and use its returned local bindings; never accepts a public HTTP Request.
 * @returns {Promise<Readonly<{ok:boolean,code:string,stage:string}>>}
 */
export async function executePhase22LocalMediaTransaction({
  environment,db,r2,shop=SHOP,session,detail,submissionId,selector,
  registryKey,originalBytes,declaredMime,fetchCodec,
  providerSnapshot,nowMs,stage='canary',enabled=false,
  simulateAckLoss=false,mutatePutOptions,
}={}){
  localOnly(environment,db,r2);
  if(stage!=='canary'||enabled!==true)
    return respond('disabled','preflight');
  if(shop!==SHOP||typeof fetchCodec!=='function'||
     !Number.isSafeInteger(nowMs)||nowMs<=0||
     typeof registryKey!=='string'||registryKey.length<32)
    return respond('invalid_configuration','preflight');
  // This is NOT SDK authentication. Synthetic session input is test-only.
  const permission=await readWorkMerchantPermission({
    db,session,action:'requests.read',
  });
  if(permission?.allowed!==true||permission.role!=='owner')
    return respond('owner_denied','authorization');
  let selected;
  try{
    selected=chooseWorkOwnerReference({detail,submissionId,selector});
    if(selected.kind!=='opaque_id')denial();
  }catch{return respond('reference_denied','authorization');}
  if(!snapshotOk(providerSnapshot,nowMs,0))
    return respond('provider_attestation_unavailable','prewrite');
  let output;
  try{
    output=await codecSanitize(fetchCodec,declaredMime,originalBytes);
  }catch{return respond('sanitization_failed','sanitizer');}
  if(!snapshotOk(providerSnapshot,nowMs,output.length))
    return respond('provider_attestation_unavailable','prewrite');

  // Registry may be idempotently seeded before reservation. No quota/R2
  // object exists if this step fails. An existing conflicting MAC fails.
  try{await registryPending(db,detail,submissionId,selector,registryKey,nowMs);}
  catch{return respond('registry_unavailable','registry');}
  const sha=digest(output);
  let plan,receipt;
  try{
    plan=planWorkR2AtomicIntentBatch({
      shop,detail,submissionId,selector,registryKey,
      contentSha256:sha,byteLength:output.length,nowMs,
    });
    const results=await db.batch(plan.statements.map(statement=>
      db.prepare(statement.sql).bind(...statement.params)));
    receipt=inspectWorkR2AtomicBatchReceipt({plan,results});
    if(receipt.upload_authorized!==false)denial();
  }catch{
    // The D1 outcome could be uncertain. NO R2 PUT, NO retry, NO refund.
    return respond('reservation_unconfirmed','reservation');
  }

  // EXTRA TEST-ONLY LOCAL R2 operation. The Phase 16 production gate
  // STILL returns upload_authorized:false and is not bypassed for real
  // provider use. This conditional write cannot run from any route.
  // The returned object key remains private inside this function.
  const intent=plan.intent;
  try{
    const putOptions={
      onlyIf:{etagDoesNotMatch:'*'},storageClass:'Standard',sha256:sha,
      httpMetadata:{
        contentType:'application/octet-stream',
        cacheControl:'private, no-store',
        contentDisposition:'attachment',
      },
      customMetadata:{
        work_stage:'quarantine_v1',
        sha256:sha,
        reference_mac:intent.reference_mac,
      },
    };
    // Fault injection permitted only in this synthetic module.
    if(typeof mutatePutOptions==='function')mutatePutOptions(putOptions);
    const put=await r2.put(intent.object_key,new Uint8Array(output),putOptions);
    if(!put)throw Error('synthetic_put_precondition_failed');
    if(simulateAckLoss===true)throw Error('synthetic_ack_lost');
  }catch{
    // HEAD+GET are the ONLY permitted recovery observations.
  }
  return reconcileOnce(db,r2,intent,Math.max(nowMs+1,Date.now()));
}
