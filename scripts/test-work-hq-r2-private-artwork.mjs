// Entirely SYNTHETIC private R2 bucket, uploads, Owner, and Google detail.
// No Cloudflare account/bucket, customer records, secrets or Worker writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';
import {
  WORK_R2_BUCKET_NAME,WORK_R2_BINDING,
  assertWorkR2NotActivated,
  stageWorkOwnerArtworkToPrivateR2,
} from '../services/jill-order-desk/work-private-r2-storage.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const makePng=(w,h=8)=>{
  const b=Buffer.alloc(33,0);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
  b.writeUInt32BE(13,8);b.write('IHDR',12,'ascii');
  b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);
  return b; // fixtures are headers only, never treated as actual decoded images.
};
const raw=makePng(8),sanitized=makePng(9);
const canonical={
  version:1,operation:'custom_order.submit',
  submission_id:ID,submitted_at:'2026-10-16T14:00:00.000Z',
  customer:{name:'Synthetic WORK',email:'synthetic@example.invalid'},
  planning:{fulfillment:'pickup',date_needed:'2026-11-01'},
  items:[{item_id:'shopify-product:101',product_id:'shopify-product:101',
    title:'Synthetic Coloring Books',quantity:2,attributes:[],
    personalization_groups:[
      {id:'P1',allocations:[{unit_id:'u1'}],attributes:[{id:'name',value:'Ava'}]},
      {id:'P2',allocations:[{unit_id:'u2'}],attributes:[{id:'name',value:'Mia'}]},
    ],reference_ids:['jill:artwork-original-101']}],
  request_attributes:[],
  reference_ids:['https://res.cloudinary.com/synthetic-work/image/upload/v1792000000/old.png'],
};
const detail=project({
  rawPayload:JSON.stringify(canonical),submissionId:ID,
  revision:2,ownerAuthorized:true,
});
assert.deepEqual(detail.items[0].personalization_groups.map(x=>x.id),['P1','P2']);
assert.ok(Object.isFrozen(detail));
const realConfig=JSON.parse(readFileSync(
  'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
assert.deepEqual(assertWorkR2NotActivated(realConfig),{
  r2_binding:'absent',media_runtime:'disabled',
});
for(const config of [
  {...realConfig,r2_buckets:[{binding:WORK_R2_BINDING,bucket_name:WORK_R2_BUCKET_NAME}]},
  {...realConfig,r2_buckets:[]},
  {...realConfig,name:'jill-order-desk-live'},
  {...realConfig,vars:{...realConfig.vars,JILL_WORK_MEDIA_R2_ENABLED:'true'}},
  {...realConfig,d1_databases:[{
    ...realConfig.d1_databases[0],database_id:'LIVE_UUID',
  }]},
]){
  assert.throws(()=>assertWorkR2NotActivated(config),
    /work_r2_private_storage_not_authorized/);
}
assert.deepEqual(readdirSync('services/jill-order-desk/migrations').sort(),[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
]);
const nowMs=1792150000000;
const owner={verifiedAdminSession:'SYNTHETIC_ONLY'};
const privateProof={
  source:'cloudflare_owner_verified_bucket_settings',
  bucket_name:WORK_R2_BUCKET_NAME,binding_name:WORK_R2_BINDING,
  bucket_public_dev_url_enabled:false,
  bucket_public_custom_domain_enabled:false,
  cloud_account_matches_work:true,checked_at_ms:nowMs,
};
let authReads=0,googleReads=0,bucketChecks=0,sanitizeCalls=0;
let puts=0,heads=0,gets=0;
function fakeBucket(mode='good'){
  const saved=new Map();
  return {
    async put(key,bytes,opts){
      puts++;
      assert.match(key,/^work-artwork\/v1\/[a-f0-9-]{36}$/);
      assert.ok(!key.includes('shopify')&&!key.includes('jill:')&&
        !key.includes('synthetic')&&!key.includes('res.cloudinary'));
      assert.equal(opts.onlyIf.get('If-None-Match'),'*');
      assert.equal(opts.httpMetadata.contentDisposition,'attachment');
      assert.equal(opts.httpMetadata.cacheControl,
        'private, no-store, max-age=0');
      assert.equal(opts.httpMetadata.contentType,'image/png');
      assert.equal(opts.customMetadata.lifecycle,'work_private_unregistered');
      assert.ok(!Object.values(opts.customMetadata).some(x=>x.includes('@')));
      if(mode==='collision')return null;
      saved.set(key,{bytes:Buffer.from(bytes),opts});
      return {key,size:bytes.length};
    },
    async head(key){
      heads++;
      const entry=saved.get(key);
      if(!entry)return null;
      return {
        key, size:mode==='bad-size'?entry.bytes.length+1:entry.bytes.length,
        httpMetadata:entry.opts.httpMetadata,
        customMetadata:mode==='bad-hash'?
          {...entry.opts.customMetadata,content_sha256:'0'.repeat(64)}:
          entry.opts.customMetadata,
      };
    },
    async get(key){
      gets++;
      const entry=saved.get(key);
      if(!entry)return null;
      return {
        key,size:entry.bytes.length,
        async arrayBuffer(){
          const b=Buffer.from(entry.bytes);
          if(mode==='corrupt-read')b[20]^=0xff;
          return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
        },
      };
    },
  };
}
const auth=async ({context,shop,submissionId,action})=>{
  authReads++;
  assert.equal(context,owner);
  assert.equal(shop,SHOP);assert.equal(submissionId,ID);
  assert.equal(action,'requests.read');
  return {allowed:true,role:'owner',shop:SHOP,submission_id:ID,
    source:'shopify_online_plus_work_d1'};
};
const read=async ({submissionId})=>{
  googleReads++;assert.equal(submissionId,ID);return detail;
};
const sanitizer=async ({inputBytes,declaredMime,maximumBytes})=>{
  sanitizeCalls++;
  assert.equal(declaredMime,'image/png');
  assert.equal(maximumBytes,8*1024*1024);
  assert.equal(Buffer.compare(inputBytes,raw),0);
  return {operation:'trusted_decode_and_reencode_v1',
    sanitizer_verified:true,bytes:sanitized,mime_type:'image/png'};
};
const confirm=async ()=>{
  bucketChecks++;return privateProof;
};
const selector={scope:'item',itemId:'shopify-product:101',index:0};
const base={
  shop:SHOP,submissionId:ID,selector,verifiedAdminContext:owner,
  authorizeWorkOwner:auth,readVerifiedRequestDetail:read,
  inputBytes:raw,declaredMime:'image/png',
  decodeAndReencode:sanitizer,
  confirmPrivateBucket:confirm,nowMs,
};
const receipt=await stageWorkOwnerArtworkToPrivateR2({
  ...base,bucket:fakeBucket(),
});
assert.equal(receipt.state,'r2_object_staged_unregistered');
assert.equal(receipt.registry_state,'not_written');
assert.equal(receipt.delivery_state,'disabled');
assert.equal(receipt.provider_public_access,
  'not_independently_attested_by_this_receipt');
assert.equal(receipt.byte_length,sanitized.length);
assert.equal(receipt.mime_type,'image/png');
assert.equal(receipt.content_sha256,
  createHash('sha256').update(sanitized).digest('hex'));
assert.ok(Object.isFrozen(receipt));
assert.match(receipt.object_key,/^work-artwork\/v1\/[0-9a-f-]{36}$/);
assert.equal(authReads,1);assert.equal(googleReads,1);
assert.equal(bucketChecks,1);assert.equal(sanitizeCalls,1);
assert.equal(puts,1);assert.equal(heads,1);assert.equal(gets,1);
assert.ok(!Object.keys(receipt).some(x=>/url|token|signed|public_id/i.test(x)));

// Authentication MUST precede canonical request reads, bucket checks,
// decoder use or ANY object operation.
for(const grant of [
  null,{allowed:false,role:'owner',shop:SHOP,submission_id:ID,
    source:'shopify_online_plus_work_d1'},
  {allowed:true,role:'viewer',shop:SHOP,submission_id:ID,
    source:'shopify_online_plus_work_d1'},
  {allowed:true,role:'owner',shop:'jill-live.myshopify.com',
    submission_id:ID,source:'shopify_online_plus_work_d1'},
  {allowed:true,role:'owner',shop:SHOP,submission_id:ID,
    source:'customer_claimed_owner'},
]){
  let protectedReads=0,protectedWrites=0;
  await assert.rejects(()=>stageWorkOwnerArtworkToPrivateR2({
    ...base,
    authorizeWorkOwner:async()=>grant,
    readVerifiedRequestDetail:async()=>{protectedReads++;return detail;},
    confirmPrivateBucket:async()=>{protectedWrites++;return privateProof;},
    decodeAndReencode:async()=>{protectedWrites++;return sanitizer({inputBytes:raw,declaredMime:'image/png',maximumBytes:8*1024*1024});},
    bucket:fakeBucket(),
  }),/work_r2_private_storage_not_authorized/);
  assert.equal(protectedReads,0);
  assert.equal(protectedWrites,0);
}
for(const changed of [
  {shop:'jillonlinestore.myshopify.com'},
  {selector:{scope:'item',itemId:'shopify-product:999',index:0}},
  {selector:{scope:'request',index:0}}, // public Cloudinary legacy
  {selector:{...selector,url:'https://evil.invalid'}},
  {verifiedAdminContext:null},
  {inputBytes:'https://res.cloudinary.com/invalid/image/upload/x.png'},
  {declaredMime:'image/svg+xml'},
  {decodeAndReencode:null},
  {confirmPrivateBucket:null},
  {bucket:null},
]){
  const before=puts;
  await assert.rejects(()=>stageWorkOwnerArtworkToPrivateR2({
    ...base,...changed,bucket:changed.bucket===undefined?fakeBucket():changed.bucket,
  }),/work_r2_private_storage_not_authorized/);
  assert.equal(puts,before);
}
for(const proof of [
  {...privateProof,bucket_name:'jill-live-private-artwork'},
  {...privateProof,binding_name:'LIVE_R2'},
  {...privateProof,bucket_public_dev_url_enabled:true},
  {...privateProof,bucket_public_custom_domain_enabled:true},
  {...privateProof,cloud_account_matches_work:false},
  {...privateProof,source:'browser_assertion'},
  {...privateProof,checked_at_ms:nowMs-6*60*1000},
  {...privateProof,checked_at_ms:nowMs+1000},
  {...privateProof,evil:'injected'},
  null,
]){
  const before=puts;
  await assert.rejects(()=>stageWorkOwnerArtworkToPrivateR2({
    ...base,bucket:fakeBucket(),confirmPrivateBucket:async()=>proof,
  }),/work_r2_private_storage_not_authorized/);
  assert.equal(puts,before);
}
for(const fakeSanitized of [
  {operation:'trusted_decode_and_reencode_v1',sanitizer_verified:true,
    mime_type:'image/png',bytes:raw}, // unchanged bytes blocked
  {operation:'client_claimed_safe',sanitizer_verified:true,
    mime_type:'image/png',bytes:sanitized},
  {operation:'trusted_decode_and_reencode_v1',sanitizer_verified:false,
    mime_type:'image/png',bytes:sanitized},
  {operation:'trusted_decode_and_reencode_v1',sanitizer_verified:true,
    mime_type:'image/svg+xml',bytes:sanitized},
  {operation:'trusted_decode_and_reencode_v1',sanitizer_verified:true,
    mime_type:'image/png',bytes:'https://public.invalid/art.png'},
  null,
]){
  const before=puts;
  await assert.rejects(()=>stageWorkOwnerArtworkToPrivateR2({
    ...base,bucket:fakeBucket(),decodeAndReencode:async()=>fakeSanitized,
  }),/work_r2_private_storage_not_authorized/);
  assert.equal(puts,before);
}
for(const mode of ['collision','bad-size','bad-hash','corrupt-read']){
  await assert.rejects(()=>stageWorkOwnerArtworkToPrivateR2({
    ...base,bucket:fakeBucket(mode),
  }),/work_r2_private_storage_not_authorized/);
}
const src=readFileSync(
  'services/jill-order-desk/work-private-r2-storage.mjs','utf8');
assert.doesNotMatch(src,/createSignedUrl|https:\/\/.*r2\.dev|\bfetch\(|\.delete\(|\.list\(|INSERT INTO|UPDATE jill_/);
assert.match(src,/NOT runtime-wired today/);
assert.match(src,/onlyIf:new Headers\(\{'If-None-Match':'\*'\}\)/);
assert.match(src,/await bucket\.head\(key\)/);
assert.match(src,/await bucket\.get\(key\)/);
assert.doesNotMatch(JSON.stringify(realConfig),/JILL_WORK_PRIVATE_ARTWORK_R2/);
console.log('PASS WORK R2 PRIVATE staging adapter OFFLINE: authenticated Owner->Google->private bucket check->decoder->no-overwrite PUT->HEAD/GET digest, public links denied, no grants or D1 writes, no runtime bucket binding.');
