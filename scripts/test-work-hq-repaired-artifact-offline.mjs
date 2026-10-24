import assert from 'node:assert/strict';
import {
 FIX_PIN,reviewRepairedWorkHqArtifact,
} from './review-work-hq-repaired-artifact-offline.mjs';
const b=(manifest,artifact)=>({manifest,artifact});
const original={
 name:'jill-order-desk-canary-work',workers_dev:true,
 preview_urls:false,
 d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
  database_id:'3f17c186-c794-4e00-8f20-017191373a19'}],
 vars:{
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_CATALOG_ENABLED:'true',
  JILL_WORK_CONVERSATION_ENABLED:'false',
  JILL_WORK_HQ_DETAIL_ENABLED:'true',
  JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
 },
 secrets:{required:[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
 ]},
};
const repaired={...structuredClone(original),
 version_metadata:{binding:'CF_VERSION_METADATA'}};
const originalEvidence={
 fingerprint_sha256:'c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996',
 manifest_sha256:'890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671',
 bundled_file_count:50,private_worker_entry_found:true,
};
const repairedEvidence={
 fingerprint_sha256:FIX_PIN.fingerprint,
 manifest_sha256:FIX_PIN.manifest,
 bundled_file_count:FIX_PIN.bundledFiles,
 private_worker_entry_found:true,
};
const check=(o=original,r=repaired,a=originalEvidence,f=repairedEvidence)=>
 reviewRepairedWorkHqArtifact({
  original:o,repaired:r,originalEvidence:a,repairedEvidence:f,
 });
const report=check();
assert.equal(report.status,'HOLD');
assert.equal(report.only_change,'add version_metadata.binding CF_VERSION_METADATA');
assert.equal(report.original_work_oauth_and_business_flags_preserved,true);
assert.equal(report.cloudflare_reads,0);
assert.equal(report.cloudflare_writes,0);
assert.equal(report.release_authorized,false);
assert.equal(report.traffic_changed,false);
assert.equal(report.corrected_artifact_sha256,FIX_PIN.fingerprint);
const variants=[
 x=>{delete x.version_metadata;},
 x=>{x.version_metadata.binding='WRONG';},
 x=>{x.version_metadata.extra=true;},
 x=>{x.vars.JILL_WORK_OAUTH_ENABLED='false';},
 x=>{x.vars.JILL_WORK_CONTACT_INBOX_ENABLED='true';},
 x=>{x.preview_urls=true;},
 x=>{x.d1_databases[0].database_id='some_other_db';},
 x=>{x.secrets.required.pop();},
 x=>{x.services=[{binding:'OTHER',service:'other'}];},
];
for(const mutate of variants){
 const copy=structuredClone(repaired);mutate(copy);
 assert.throws(()=>check(original,copy),
  /work_hq_repaired_artifact_review_/);
}
for(const broken of [
 {...repairedEvidence,manifest_sha256:'0'.repeat(64)},
 {...repairedEvidence,fingerprint_sha256:'0'.repeat(64)},
 {...repairedEvidence,bundled_file_count:49},
 {...repairedEvidence,private_worker_entry_found:false},
]){
 assert.throws(()=>check(original,repaired,originalEvidence,broken),
  /work_hq_repaired_artifact_review_repaired_manifest_or_bundle_not_owner_pinned/);
}
assert.throws(()=>check(original,repaired,{
 ...originalEvidence,manifest_sha256:'0'.repeat(64),
}),/contact_inactive_upload_offline_owner_pinned_local_bytes_changed/);
assert.deepEqual(repaired.version_metadata,{binding:'CF_VERSION_METADATA'});
console.log('PASS WORK repaired HQ 50-file artifact immutable source/hash parity, 14th metadata binding restored, no upload or traffic approval.');
