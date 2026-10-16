// JILL WORK — real local Sharp decoder + simulated R2 quarantine integration.
// Entirely synthetic. No customer files, Cloudflare credentials, network,
// Worker, R2 storage, D1 mutation, Google call, or deployed upload/preview.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {sanitizeWorkArtworkLocally} from './sanitize.mjs';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../../services/jill-order-desk/merchant-request-detail.mjs';
import {
  stageWorkOwnerR2Quarantine as stage,
  WORK_R2_PRIVATE_BUCKET as BUCKET,
  WORK_R2_PRIVATE_BINDING as BINDING,
} from '../../services/jill-order-desk/work-private-r2-quarantine.mjs';

const shop='jill-work.myshopify.com';
const id='jill:11111111-2222-4333-8444-555555555555';
const key='SYNTHETIC_TEST_ONLY_WORK_32_BYTE_REGISTRY_MAC_KEY';
const now=1792160000000;
const legacy='https://res.cloudinary.com/synthetic-work/image/upload/old.png';
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
  request_attributes:[],reference_ids:[legacy],
};
const detail=project({
  rawPayload:JSON.stringify(raw),submissionId:id,revision:2,
  ownerAuthorized:true,
});
const privateMarker='PRIVATE_TEST_METADATA_SENTINEL';
const input=await sharp({
  create:{width:100,height:80,channels:3,background:'#2c5081'},
}).jpeg().withExif({IFD0:{Artist:privateMarker}}).toBuffer();
assert.ok((await sharp(input).metadata()).exif,
  'fixture MUST contain EXIF to prove stripping');
const originalSha=createHash('sha256').update(input).digest('hex');

const ctx=Object.freeze({serverVerifiedOwner:'SYNTHETIC_ONLY'});
const count={authorized:0,read:0,decode:0,audit:0,put:0,head:0,get:0,del:0};
const owner=async ({context,shop:targetShop,submissionId,action})=>{
  count.authorized++;
  assert.equal(context,ctx);
  assert.equal(targetShop,shop);
  assert.equal(submissionId,id);
  assert.equal(action,'requests.read');
  return {allowed:true,role:'owner',shop,submission_id:id,
    source:'shopify_online_plus_work_d1'};
};
const reader=async ({submissionId})=>{
  count.read++;
  assert.equal(submissionId,id);
  assert.equal(count.authorized>0,true,
    'Owner/D1 check must precede canonical Google detail');
  return detail;
};
const sanitizer=async ({bytes,declaredMime,maxOutputBytes})=>{
  count.decode++;
  assert.equal(count.read>=count.decode,true,
    'canonical detail must precede image decoding');
  assert.equal(maxOutputBytes,8*1024*1024);
  return sanitizeWorkArtworkLocally({bytes,declaredMime,maxOutputBytes});
};
const privacy=async ({bucket,binding})=>{
  count.audit++;
  assert.equal(bucket,BUCKET);
  assert.equal(binding,BINDING);
  return {source:'cloudflare_r2_account_privacy_audit_v1',
    bucket:BUCKET,binding:BINDING,bucket_exists:true,
    public_dev_url_enabled:false,custom_domain_count:0,
    checked_at_ms:now-1000};
};
let stored;
const r2={
  async put(objectKey,data,options){
    count.put++;
    assert.equal(count.decode>=count.put,true);
    assert.equal(count.audit>=count.put,true);
    assert.match(objectKey,/^work\/quarantine\/v1\/[0-9a-f-]{36}$/);
    assert.doesNotMatch(objectKey,/jill:|Synthetic|Ava|Mia|shopify|cloudinary/i);
    assert.deepEqual(options.onlyIf,{etagDoesNotMatch:'*'});
    assert.equal(options.httpMetadata.contentType,'application/octet-stream');
    assert.equal(options.httpMetadata.cacheControl,'private, no-store');
    assert.equal(options.httpMetadata.contentDisposition,'attachment');
    assert.equal(options.customMetadata.work_stage,'quarantine_v1');
    assert.match(options.customMetadata.reference_mac,/^[a-f0-9]{64}$/);
    const bytes=Buffer.from(data);
    assert.notDeepEqual(bytes,input,'R2 must only see re-encoded bytes');
    assert.equal(bytes.includes(Buffer.from(privateMarker)),false);
    const metadata=await sharp(bytes).metadata();
    assert.equal(metadata.format,'jpeg');
    assert.equal(metadata.exif,undefined);
    assert.equal(metadata.icc,undefined);
    assert.equal(metadata.orientation,undefined);
    const hash=createHash('sha256').update(bytes).digest('hex');
    assert.notEqual(hash,originalSha,'output hash must differ from source');
    assert.equal(options.sha256,hash);
    assert.equal(options.customMetadata.sha256,hash);
    stored={key:objectKey,size:bytes.length,
      httpMetadata:options.httpMetadata,
      customMetadata:options.customMetadata};
    return {...stored};
  },
  async head(objectKey){
    count.head++;
    assert.equal(objectKey,stored?.key);
    return {...stored};
  },
  async get(){count.get++;throw Error('GET is prohibited');},
  async delete(){count.del++;throw Error('DELETE is prohibited');},
};
const args={
  shop,submissionId:id,
  selector:{scope:'item',itemId:'shopify-product:101',index:0},
  verifiedAdminContext:ctx,authorizeWorkOwner:owner,
  readVerifiedRequestDetail:reader,registryKey:key,
  bytes:input,declaredMime:'image/jpeg',
  sanitizeArtwork:sanitizer,verifyPrivateWorkBucket:privacy,
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
  /https?:|cloudinary|email|reference_mac|sha256|objectKey|asset_id/i);
assert.deepEqual(count,{authorized:1,read:1,decode:1,audit:1,
  put:1,head:1,get:0,del:0});

// A foreign/unverified staff grant cannot read the canonical request,
// decode private bytes, or touch even a mocked R2 bucket.
const before={...count};
await assert.rejects(()=>stage({...args,authorizeWorkOwner:async()=>({
  allowed:true,role:'viewer',shop,submission_id:id,
  source:'shopify_online_plus_work_d1',
})}),/access_denied/);
assert.deepEqual(
  {read:count.read,decode:count.decode,audit:count.audit,put:count.put},
  {read:before.read,decode:before.decode,audit:before.audit,put:before.put}
);

// Existing publicly delivered Cloudinary URL is NOT a new private upload.
const old=count.put;
await assert.rejects(()=>stage({...args,
  selector:{scope:'request',index:0},
}),/work_r2_private_quarantine_not_authorized/);
assert.equal(count.put,old);

// A spoofed JPEG header passes the prior shallow byte check but MUST
// fail the real decoder before R2 receives anything.
const invalid=Buffer.alloc(48);
invalid.set([0xff,0xd8,0xff,0xe0],0);
invalid[46]=0xff;invalid[47]=0xd9;
await assert.rejects(()=>stage({...args,bytes:invalid}),
  /work_r2_private_quarantine_not_authorized/);
assert.equal(count.put,old);

// A public bucket or stale privacy receipt must block storage even
// after the real decoder has cleaned the synthetic bytes.
for (const overrides of [
  {public_dev_url_enabled:true},
  {custom_domain_count:1},
  {checked_at_ms:now-3600000},
]){
  await assert.rejects(()=>stage({...args,
    verifyPrivateWorkBucket:async p=>({
      ...await privacy(p),...overrides,
    }),
  }),/work_r2_private_quarantine_not_authorized/);
  assert.equal(count.put,old);
}
assert.equal(count.get,0);assert.equal(count.del,0);
console.log('PASS WORK local decoder + quarantine integration: signed detail after Owner gate, genuine JPEG EXIF stripped, verified mock R2 PUT/HEAD, blocked legacy/foreign/invalid/public inputs; NO cloud operations.');
