import assert from 'node:assert/strict';
import {reviewLockedLocalHqArtifact}
 from './review-work-contact-inactive-upload-offline.mjs';

const good={
 manifest:{
  name:'jill-order-desk-canary-work',
  workers_dev:true,preview_urls:false,
  vars:{
   JILL_WORK_HOST_STAGE:'canary',
   JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
   JILL_WORK_OAUTH_ENABLED:'true',
   JILL_WORK_CATALOG_ENABLED:'true',
   JILL_WORK_CONVERSATION_ENABLED:'false',
   JILL_WORK_HQ_DETAIL_ENABLED:'true',
   JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
   JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
   JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED:'false',
  },
  d1_databases:[{
   binding:'JILL_ORDER_DESK_WORK_DB',
   database_id:'3f17c186-c794-4e00-8f20-017191373a19',
  }],
  secrets:{required:[
   'SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
   'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  ]},
 },
 artifact:{
  fingerprint_sha256:'c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996',
  manifest_sha256:'890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671',
  bundled_file_count:50,private_worker_entry_found:true,
 },
};
const snapshot=JSON.stringify(good);
const ok=reviewLockedLocalHqArtifact(good);
assert.equal(ok.environment,'WORK');
assert.equal(ok.status,'HOLD');
assert.equal(ok.local_artifact_matches_owner_pin,true);
assert.equal(ok.preview_disabled_in_local_manifest,true);
assert.equal(ok.remote_current_versions_rechecked,false);
assert.equal(ok.free_tier_usage_verified,false);
assert.equal(ok.uploaded_secret_continuity_verified,false);
assert.equal(ok.release_authorized,false);
assert.equal(ok.worker_uploaded,false);
assert.equal(JSON.stringify(good),snapshot);
assert.equal(Object.prototype.hasOwnProperty.call(ok,'manifest'),false);
const broken=(change)=>{const copy=structuredClone(good);change(copy);return copy;};
const cases=[
 c=>{c.manifest.name='jill-order-desk-live';},
 c=>{c.manifest.workers_dev=false;},
 c=>{c.manifest.preview_urls=true;},
 c=>{delete c.manifest.preview_urls;},
 c=>{c.manifest.vars.JILL_WORK_OAUTH_ENABLED='false';},
 c=>{c.manifest.vars.JILL_WORK_CATALOG_ENABLED='false';},
 c=>{c.manifest.vars.JILL_WORK_MERCHANT_WRITES_ENABLED='false';},
 c=>{c.manifest.vars.JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED='true';},
 c=>{c.manifest.vars.JILL_WORK_CONTACT_INTAKE_ENABLED='true';},
 c=>{c.manifest.d1_databases[0].database_id='wrong';},
 c=>{c.manifest.d1_databases.push({binding:'OTHER',database_id:'wrong'});},
 c=>{c.manifest.secrets.required.pop();},
 c=>{c.manifest.secrets.required[0]='DIFFERENT';},
 c=>{c.manifest.services=[{binding:'UNEXPECTED',service:'other'}];},
 c=>{c.artifact.fingerprint_sha256='0'.repeat(64);},
 c=>{c.artifact.manifest_sha256='0'.repeat(64);},
 c=>{c.artifact.bundled_file_count=49;},
 c=>{c.artifact.private_worker_entry_found=false;},
];
for(const modify of cases){
 assert.throws(()=>reviewLockedLocalHqArtifact(broken(modify)),
  /contact_inactive_upload_offline_/);
}
assert.throws(()=>reviewLockedLocalHqArtifact(),
 /contact_inactive_upload_offline_missing_evidence/);
console.log('PASS WORK Contact locked local artifact: owner SHA pin, OAuth, business flags, private D1, secrets, preview disabled, contact OFF; 18 refusal cases; always HOLD; no uploads.');
