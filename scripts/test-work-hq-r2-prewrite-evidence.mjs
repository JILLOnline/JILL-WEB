// WORK Phase 16: synthetic pre-write validation regression.
// No cloud operations, images binding, HTTP route, D1 writes or R2.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';
import {planWorkR2AtomicIntentBatch as planBatch}
  from '../services/jill-order-desk/work-private-r2-d1-batch-plan.mjs';
import {inspectWorkR2PrewriteEvidence as check,
  WORK_R2_ACCOUNT_SOFT_LIMITS as LIMITS}
  from '../services/jill-order-desk/work-private-r2-prewrite-evidence.mjs';
const root='services/jill-order-desk/';
assert.deepEqual(readdirSync(root+'migrations').sort(),[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
]);
for(const config of ['wrangler.jsonc','wrangler.canary.jsonc']){
  const c=JSON.parse(readFileSync(root+'app-home/'+config,'utf8'));
  assert.equal(c.r2_buckets,undefined);
}
const id='jill:11111111-2222-4333-8444-555555555555';
const shop='jill-work.myshopify.com';
const now=Date.parse('2026-10-16T12:00:00.000Z');
const payload={
  version:1,operation:'custom_order.submit',submission_id:id,
  submitted_at:'2026-10-16T10:00:00Z',
  customer:{name:'Only Synthetic',email:'nobody@example.invalid'},
  planning:{fulfillment:'pickup'},
  items:[{
    item_id:'shopify-product:101',product_id:'shopify-product:101',
    title:'Synthetic',quantity:1,attributes:[],
    personalization_groups:[],reference_ids:['jill:opaque-001'],
  }],request_attributes:[],reference_ids:[],
};
const detail=project({rawPayload:JSON.stringify(payload),
  submissionId:id,revision:1,ownerAuthorized:true});
const bytes=Buffer.alloc(33,0);
Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
bytes.writeUInt32BE(13,8);
bytes.write('IHDR',12);
bytes.writeUInt32BE(10,16);
bytes.writeUInt32BE(10,20);
// Synthetic header-only candidate — deliberately NOT a decoded image.
// This test checks contract binding and quota holds, not image safety.
const plan=planBatch({shop,detail,submissionId:id,
  selector:{scope:'item',itemId:'shopify-product:101',index:0},
  registryKey:'SYNTHETIC_ONLY_WORK_KEY_32_CHARACTERS_OR_LONGER',
  contentSha256:createHash('sha256').update(bytes).digest('hex'),
  byteLength:bytes.length,nowMs:now,
});
const i=plan.intent;
const quota={
  shop,month_key:plan.monthKey,lifetime_reserved_bytes:bytes.length,
  month_uploads:1,month_class_a:1,month_class_b:1,
  lifetime_reservations:1,
};
const intentRow={
  shop:i.shop,submission_id:i.submission_id,scope:i.scope,
  item_key:i.item_key,reference_index:i.reference_index,
  reference_mac:i.reference_mac,reservation_id:i.reservation_id,
  object_key:i.object_key,content_sha256:i.content_sha256,
  byte_length:i.byte_length,state:i.state,
};
const batchResults=[
  {success:true,results:[quota]},
  {success:true,results:[intentRow]},
];
const accountUsage={
  source:'trusted_server_cloudflare_r2_account_usage_v1',
  account_id:'1cae999d55b9df68a81ad876fb040e60',
  shop,plan:'free',storage_class:'Standard',
  complete:true,includes_other_buckets_and_services:true,
  billable_overage_possible:false,period_utc:plan.monthKey,
  checked_at_ms:now-1000,
  standard_bytes_current:0,projected_month_standard_gb_month:0,
  class_a_month:0,class_b_month:0,
};
const bucketPrivacy={
  source:'trusted_server_cloudflare_r2_privacy_snapshot_v1',
  account_id:accountUsage.account_id,
  bucket:'jill-work-private-artwork',
  storage_class:'Standard',public_dev_url_enabled:false,
  custom_domain_count:0,checked_at_ms:now-1000,
};
const fixture={plan,batchResults,sanitizedBytes:bytes,
  declaredMime:'image/png',accountUsage,bucketPrivacy,nowMs:now};
const okay=check(fixture);
assert.deepEqual(okay,{
  state:'synthetic_prewrite_checks_satisfied',
  evidence_is_provider_authenticated:false,
  upload_authorized:false,preview_enabled:false,
  auto_retry:false,auto_delete:false,quota_refund:false,
  remote_migration_authorized:false,
});
assert.ok(Object.isFrozen(okay));
const cases=[
  {plan:{...plan,state:'browser_claim'}},
  {plan:{...plan,intent:{...i,byte_length:31}}},
  {batchResults:[]},
  {batchResults:[{success:false,results:[quota]},batchResults[1]]},
  {batchResults:[batchResults[0],{success:true,
    results:[{...intentRow,object_key:'foreign'}]}]},
  {sanitizedBytes:Buffer.from(bytes).fill(1,25)},
  {sanitizedBytes:Buffer.from('https://example.invalid/media.png')},
  {declaredMime:'image/jpeg'},
  {accountUsage:null},
  {accountUsage:{...accountUsage,source:'browser_claim'}},
  {accountUsage:{...accountUsage,account_id:'live'}},
  {accountUsage:{...accountUsage,shop:'jillonlinestore.myshopify.com'}},
  {accountUsage:{...accountUsage,complete:false}},
  {accountUsage:{...accountUsage,includes_other_buckets_and_services:false}},
  {accountUsage:{...accountUsage,billable_overage_possible:true}},
  {accountUsage:{...accountUsage,period_utc:'2026-09'}},
  {accountUsage:{...accountUsage,checked_at_ms:now-3600000}},
  {accountUsage:{...accountUsage,standard_bytes_current:LIMITS.max_current_standard_bytes}},
  {accountUsage:{...accountUsage,projected_month_standard_gb_month:1.001}},
  {accountUsage:{...accountUsage,class_a_month:LIMITS.max_month_class_a}},
  {accountUsage:{...accountUsage,class_b_month:LIMITS.max_month_class_b}},
  {accountUsage:{...accountUsage,plan:'paid'}},
  {bucketPrivacy:null},
  {bucketPrivacy:{...bucketPrivacy,source:'user_reported'}},
  {bucketPrivacy:{...bucketPrivacy,account_id:'foreign'}},
  {bucketPrivacy:{...bucketPrivacy,public_dev_url_enabled:true}},
  {bucketPrivacy:{...bucketPrivacy,custom_domain_count:1}},
  {bucketPrivacy:{...bucketPrivacy,checked_at_ms:now-3600000}},
  {nowMs:0},
];
for(const change of cases)
  assert.throws(()=>check({...fixture,...change}),
    /work_r2_prewrite_evidence_unverified/);
assert.equal(LIMITS.max_current_standard_bytes,512*1024*1024);
const implementation=readFileSync(
  root+'work-private-r2-prewrite-evidence.mjs','utf8');
assert.doesNotMatch(implementation,
  /\.put\(|\.get\(|\.delete\(|\.batch\(|\.run\(|\bfetch\(|createSignedUrl/);
console.log('PASS WORK R2 Phase 16 offline: synthetic committed intent/byte hash, full-account usage and private-bucket evidence required; 29 adversarial denials; no R2/D1/Cloudflare calls and upload remains OFF.');
