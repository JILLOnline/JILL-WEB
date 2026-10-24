import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,lstatSync,rmSync,symlinkSync}
 from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
 prepareWorkHqVersionMetadataRepair,writeWorkHqVersionMetadataRepair,
} from './prepare-work-hq-version-metadata-repair-local-only.mjs';
const pin='c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996';
const manifestPin='890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671';
const manifest={
 name:'jill-order-desk-canary-work',
 workers_dev:true,preview_urls:false,
 main:'./index.js',assets:{directory:'../client'},
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
const artifact={
 fingerprint_sha256:pin,manifest_sha256:manifestPin,
 bundled_file_count:50,private_worker_entry_found:true,
};
const original=structuredClone(manifest);
const planned=prepareWorkHqVersionMetadataRepair({manifest,artifact});
assert.equal(planned.status,'HOLD');
assert.deepEqual(planned.changed_keys,['version_metadata']);
assert.equal(planned.required_binding_name,'CF_VERSION_METADATA');
assert.deepEqual(planned.manifest.version_metadata,{
 binding:'CF_VERSION_METADATA',
});
assert.deepEqual(manifest,original);
assert.equal(planned.upload_authorized,false);
assert.equal(planned.traffic_change_authorized,false);
const without=structuredClone(planned.manifest);
delete without.version_metadata;
assert.deepEqual(without,manifest);
assert.equal(Object.keys(planned.manifest).length,
 Object.keys(manifest).length+1);
for(const change of [
 v=>{v.preview_urls=true;},
 v=>{v.workers_dev=false;},
 v=>{v.name='jill-order-desk-live';},
 v=>{v.vars.JILL_WORK_OAUTH_ENABLED='false';},
 v=>{v.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED='true';},
 v=>{v.vars.JILL_WORK_CONTACT_INBOX_ENABLED='true';},
 v=>{v.d1_databases[0].database_id='unapproved';},
 v=>{v.secrets.required.pop();},
 v=>{v.version_metadata={binding:'CF_VERSION_METADATA'};},
]){
 const bad=structuredClone(manifest);
 change(bad);
 assert.throws(()=>prepareWorkHqVersionMetadataRepair({
  manifest:bad,artifact,
 }),/_(?:repair|offline)_/);
}
for(const bad of [
 {...artifact,manifest_sha256:'a'.repeat(64)},
 {...artifact,fingerprint_sha256:'a'.repeat(64)},
 {...artifact,bundled_file_count:49},
]){
 assert.throws(()=>prepareWorkHqVersionMetadataRepair({
  manifest,artifact:bad,
 }),/contact_inactive_upload_offline_/);
}
const temp=mkdtempSync(join(tmpdir(),'jill-hq-metadata-'));
try{
 const out=join(temp,'wrangler.contact-owner-version-metadata-restored.json');
 const saved=writeWorkHqVersionMetadataRepair({
  original:manifest,repaired:planned.manifest,
  output:out,directory:temp,
 });
 assert.equal(saved.status,'HOLD');
 assert.equal(saved.version_uploaded,false);
 assert.equal(saved.cloudflare_operations,0);
 assert.ok(/^[a-f0-9]{64}$/.test(saved.manifest_sha256));
 assert.deepEqual(JSON.parse(readFileSync(out,'utf8')),
  planned.manifest);
 if(process.platform!=='win32')
  assert.equal(lstatSync(out).mode & 0o777,0o600);
 assert.throws(()=>writeWorkHqVersionMetadataRepair({
  original:manifest,repaired:planned.manifest,
  output:out,directory:temp,
 }),/work_hq_metadata_repair_output_not_new_or_not_in_original_build/);
 for(const mutated of [
  x=>{x.vars.JILL_WORK_OAUTH_ENABLED='false';},
  x=>{x.vars.JILL_WORK_CONTACT_INBOX_ENABLED='true';},
  x=>{x.version_metadata.binding='DIFFERENT';},
  x=>{x.services=[{binding:'UNSAFE',service:'live'}];},
  x=>{x.d1_databases[0].database_id='different';},
 ]){
  const changed=structuredClone(planned.manifest);
  mutated(changed);
  assert.throws(()=>writeWorkHqVersionMetadataRepair({
   original:manifest,repaired:changed,
   output:join(temp,'wrangler.contact-owner-version-metadata-restored.json'),
   directory:temp,
  }),/work_hq_metadata_repair_/);
 }
 const disallowed=join(temp,'other.json');
 assert.throws(()=>writeWorkHqVersionMetadataRepair({
  original:manifest,repaired:planned.manifest,
  output:disallowed,directory:temp,
 }),/work_hq_metadata_repair_output_not_new_or_not_in_original_build/);
 const escape=join(temp,'..','wrangler.contact-owner-version-metadata-restored.json');
 assert.throws(()=>writeWorkHqVersionMetadataRepair({
  original:manifest,repaired:planned.manifest,
  output:escape,directory:temp,
 }),/work_hq_metadata_repair_output_not_new_or_not_in_original_build/);
} finally{rmSync(temp,{recursive:true,force:true});}
console.log('PASS WORK HQ metadata repair: one-key version_metadata binding restoration only, pinned original evidence, 50 files, no uploads, strict refusal, always HOLD.');
