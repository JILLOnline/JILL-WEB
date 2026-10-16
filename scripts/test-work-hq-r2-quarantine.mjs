// Offline synthetic WORK-only R2 adapter regression. NO real R2 bucket,
// Cloudflare account/API, migration, Google, Shopify, Cloudinary or media.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';
import {
  stageWorkOwnerR2Quarantine as stage,
  WORK_R2_PRIVATE_BUCKET as BUCKET,
  WORK_R2_PRIVATE_BINDING as BINDING,
} from '../services/jill-order-desk/work-private-r2-quarantine.mjs';

const shop='jill-work.myshopify.com';
const id='jill:11111111-2222-4333-8444-555555555555';
const key='SYNTHETIC_TEST_ONLY_WORK_32_BYTE_REGISTRY_MAC_KEY';
const now=1792160000000;
const legacy='https://res.cloudinary.com/synthetic-work/image/upload/v1791926029/old.png';
const raw={
  version:1,operation:'custom_order.submit',submission_id:id,
  submitted_at:'2026-10-16T10:00:00Z',
  customer:{name:'Synthetic Test',email:'test@example.invalid'},
  planning:{fulfillment:'pickup',date_needed:'2026-10-30'},
  items:[{
    item_id:'shopify-product:101',product_id:'shopify-product:101',
    title:'Synthetic Coloring Books',quantity:2,attributes:[],
    personalization_groups:[
      {id:'P1',allocations:[{unit_id:'unit-1'}],
        attributes:[{id:'name',value:'Ava'}]},
      {id:'P2',allocations:[{unit_id:'unit-2'}],
        attributes:[{id:'name',value:'Mia'}]},
    ],
    reference_ids:['jill:new-artwork-001'],
  }],
  request_attributes:[],reference_ids:[legacy,'jill:another-private-ref'],
};
const detail=project({
  rawPayload:JSON.stringify(raw),submissionId:id,revision:2,
  ownerAuthorized:true,
});
const input=Buffer.alloc(33,0);
Buffer.from([137,80,78,71,13,10,26,10]).copy(input);
input.writeUInt32BE(13,8);
input.write('IHDR',12);
input.writeUInt32BE(80,16);input.writeUInt32BE(80,20);

let authorized=0,read=0,sanitized=0,audited=0,written=0,headed=0;
const ctx={serverVerifiedOwner:'SYNTHETIC_ONLY'};
const owner=async ({context,shop:theShop,submissionId,action})=>{
  authorized++;
  assert.equal(context,ctx);
  assert.equal(theShop,shop);
  assert.equal(submissionId,id);
  assert.equal(action,'requests.read');
  return {allowed:true,role:'owner',shop,submission_id:id,
    source:'shopify_online_plus_work_d1'};
};
const detailReader=async ({submissionId})=>{
  read++;assert.equal(submissionId,id);return detail;
};
const sanitizer=async ({bytes,declaredMime,maxOutputBytes})=>{
  sanitized++;
  assert.equal(declaredMime,'image/png');
  assert.equal(maxOutputBytes,8*1024*1024);
  assert.deepEqual(bytes,input);
  return {sanitized:true,mime_type:declaredMime,bytes:Buffer.from(bytes)};
};
const auditor=async ({bucket,binding})=>{
  audited++;
  assert.equal(bucket,BUCKET);assert.equal(binding,BINDING);
  return {source:'cloudflare_r2_account_privacy_audit_v1',
    bucket:BUCKET,binding:BINDING,bucket_exists:true,
    public_dev_url_enabled:false,custom_domain_count:0,
    checked_at_ms:now-1000};
};
let stored=null;
const r2={
  async put(k,data,options){
    written++;
    assert.match(k,/^work\/quarantine\/v1\/[0-9a-f-]{36}$/);
    assert.doesNotMatch(k,/shopify|cloudinary|example|jill:|Synthetic|Ava|Mia/);
    assert.deepEqual(options.onlyIf,{etagDoesNotMatch:'*'});
    assert.equal(options.sha256,
      createHash('sha256').update(input).digest('hex'));
    assert.equal(options.httpMetadata.contentType,'application/octet-stream');
    assert.equal(options.httpMetadata.cacheControl,'private, no-store');
    assert.equal(options.httpMetadata.contentDisposition,'attachment');
    assert.equal(options.customMetadata.work_stage,'quarantine_v1');
    assert.match(options.customMetadata.reference_mac,/^[a-f0-9]{64}$/);
    assert.equal(options.customMetadata.sha256,options.sha256);
    assert.deepEqual(Buffer.from(data),input);
    assert.ok(!Object.keys(options.customMetadata)
      .some(x=>/email|user|name|url|public_id|source_reference/.test(x)));
    stored={key:k,size:data.byteLength,
      httpMetadata:options.httpMetadata,customMetadata:options.customMetadata};
    return {...stored};
  },
  async head(k){
    headed++;
    assert.equal(k,stored?.key);
    return stored&&{...stored};
  },
  async get(){throw Error('GET not permitted from quarantine adapter');},
  async delete(){throw Error('DELETE not permitted from quarantine adapter');},
};
const args={
  shop,submissionId:id,
  selector:{scope:'item',itemId:'shopify-product:101',index:0},
  verifiedAdminContext:ctx,authorizeWorkOwner:owner,
  readVerifiedRequestDetail:detailReader,
  registryKey:key,bytes:input,declaredMime:'image/png',
  sanitizeArtwork:sanitizer,verifyPrivateWorkBucket:auditor,
  r2Bucket:r2,nowMs:now,
};
const receipt=await stage(args);
assert.deepEqual(receipt,{
  state:'quarantined_unlinked',private_delivery:'disabled',
  registry_persisted:false,content_verified_by_r2_head:true,
  bucket_public_access_audited:true,owner_access_recheck_required:true,
});
assert.ok(Object.isFrozen(receipt));
assert.doesNotMatch(JSON.stringify(receipt),
  /https?|cloudinary|email|SYNTHETIC|reference_mac|sha256|key|png|asset_id/i);
assert.deepEqual([authorized,read,sanitized,audited,written,headed],
  [1,1,1,1,1,1]);
const successKey=stored.key;
await stage(args);
assert.notEqual(stored.key,successKey,'new uploads require fresh random keys');
assert.equal(written,2);
const reject=async (changes,regex=/not_authorized|write_unverified|work_private_artwork_not_accepted/)=>{
  const before=[read,sanitized,audited,written,headed];
  await assert.rejects(()=>stage({...args,...changes}),regex);
  return before;
};
// Foreign and forged Shopify Owner claims must never reach canonical reader.
for(const grant of [
  {allowed:true,role:'viewer',shop,submission_id:id,
    source:'shopify_online_plus_work_d1'},
  {allowed:true,role:'owner',shop:'jillonlinestore.myshopify.com',
    submission_id:id,source:'shopify_online_plus_work_d1'},
  {allowed:true,role:'owner',shop,submission_id:id,
    source:'browser_claim'},
  {allowed:false,role:'owner',shop,submission_id:id,
    source:'shopify_online_plus_work_d1'},
]) {
  const baseline=[read,sanitized,audited,written];
  await reject({authorizeWorkOwner:async()=>grant},/access_denied/);
  assert.deepEqual([read,sanitized,audited,written],baseline);
}
for(const change of [
  {shop:'jillonlinestore.myshopify.com'},
  {verifiedAdminContext:null},{authorizeWorkOwner:null},
  {readVerifiedRequestDetail:null},
  {selector:{scope:'item',itemId:'shopify-product:missing',index:0}},
  {selector:{scope:'request',index:0,url:legacy}},
  {selector:{scope:'request',index:0}},
  {selector:{scope:'item',itemId:'shopify-product:101',index:20}},
  {registryKey:'short'},
  {bytes:legacy},{bytes:'jill:new-artwork-001'},
  {declaredMime:'image/svg+xml'},
  {sanitizeArtwork:null},{verifyPrivateWorkBucket:null},
  {r2Bucket:null},
]){
  const before=written;
  await reject(change,/not_authorized|access_denied|work_media_registry_not_authorized|work_private_artwork_not_accepted/);
  assert.equal(written,before,'untrusted input may not touch R2');
}
// Sanitizer must produce consistent bounded re-encoded content.
for(const cleaner of [
  async()=>null,
  async()=>({sanitized:false,mime_type:'image/png',bytes:input}),
  async()=>({sanitized:true,mime_type:'image/jpeg',bytes:input}),
  async()=>({sanitized:true,mime_type:'image/png',bytes:'PUBLIC_URL'}),
  async()=>({sanitized:true,mime_type:'image/png',bytes:Buffer.from('evil')}),
  async()=>{throw Error('SANITIZER_SECRET');},
]){
  const before=written;
  await reject({sanitizeArtwork:cleaner});
  assert.equal(written,before);
}
for(const audit of [
  {...await auditor({bucket:BUCKET,binding:BINDING}),bucket:'jill-live-artwork'},
  {...await auditor({bucket:BUCKET,binding:BINDING}),
    public_dev_url_enabled:true},
  {...await auditor({bucket:BUCKET,binding:BINDING}),
    custom_domain_count:1},
  {...await auditor({bucket:BUCKET,binding:BINDING}),
    checked_at_ms:now-3600000},
  {...await auditor({bucket:BUCKET,binding:BINDING}),
    source:'client_supplied'},
  null,
]){
  const before=written;
  await reject({verifyPrivateWorkBucket:async()=>audit});
  assert.equal(written,before);
}
for(const mock of [
  {put:async()=>null,head:r2.head},
  {put:async(k,d,o)=>({...stored,key:'foreign'}),head:r2.head},
  {put:async(k,d,o)=>({key:k,size:d.length,
    httpMetadata:o.httpMetadata,customMetadata:{
      ...o.customMetadata,reference_mac:'0'.repeat(64)}}),head:r2.head},
  {put:async(k,d,o)=>({key:k,size:d.length,
    httpMetadata:o.httpMetadata,customMetadata:o.customMetadata}),
    head:async()=>null},
  {put:async()=>{throw Error('OBJECT_UPLOADED_BUT_ACK_LOST');},
    head:r2.head},
]){
  const before=headed;
  await reject({r2Bucket:mock},/work_r2_quarantine_write_unverified/);
  assert.ok(headed>=before,'no destructive retry or deletion');
}
const implementation=readFileSync(
  'services/jill-order-desk/work-private-r2-quarantine.mjs','utf8');
assert.doesNotMatch(implementation,/\bfetch\(|\.get\(|\.delete\(|\.list\(|createSignedUrl|presign|publicURL|r2\.dev/);
assert.match(implementation,/await r2Bucket\.put/);
assert.match(implementation,/await r2Bucket\.head/);
assert.match(implementation,/private_delivery:'disabled'/);
assert.match(implementation,/registry_persisted:false/);
const config=JSON.parse(readFileSync(
  'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
assert.ok(!config.r2_buckets||config.r2_buckets.length===0,
  'Source-only R2 phase MUST NOT configure or deploy any storage binding');
console.log('PASS WORK R2 PRIVATE QUARANTINE offline: Owner+D1 before canonical detail and R2; opaque-only, decoded sanitizer gate, fresh audited private bucket, conditional put and verified head, no URLs/keys/preview, denied forgery/failures; NO real storage or cloud operations.');
