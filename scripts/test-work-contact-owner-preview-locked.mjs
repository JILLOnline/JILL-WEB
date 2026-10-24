import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,
 existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {preparePreviewLockedCandidate,writePreviewLockedLocal}
 from './prepare-work-contact-owner-preview-locked.mjs';
const compiled=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gatewayCandidate=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml','utf8');
const hqVersion='44ad4a81-55ad-4f49-9965-61260cc2294d';
const gatewayVersion='9322193f-5e87-4479-88c9-39229dddb5f2';
const b=(name,type,extra={})=>({name,type,...extra});
const active={
 hq:[
  b('JILL_ORDER_DESK_WORK_DB','d1',{id:
   '3f17c186-c794-4e00-8f20-017191373a19'}),
  ...[
   'SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
   'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  ].map(name=>b(name,'secret_text')),
  b('JILL_WORK_HOST_STAGE','plain_text',{text:'canary'}),
  b('JILL_WORK_OAUTH_ENABLED','plain_text',{text:'true'}),
  b('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','plain_text',{text:'false'}),
  ...[
   ['JILL_WORK_CATALOG_ENABLED','true'],
   ['JILL_WORK_CONVERSATION_ENABLED','false'],
   ['JILL_WORK_HQ_DETAIL_ENABLED','true'],
   ['JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','false'],
   ['JILL_WORK_MERCHANT_WRITES_ENABLED','true'],
  ].map(([name,text])=>b(name,'plain_text',{text})),
 ],
 gateway:[
  b('RATE_LIMITER','durable_object_namespace'),
  ...[
   'SHOPIFY_WORK_APP_SECRET','JILL_CUSTOM_ORDER_GATEWAY_SECRET',
   'JILL_CUSTOM_ORDER_QA_BACKEND_URL',
  ].map(name=>b(name,'secret_text')),
  b('CF_VERSION_METADATA','version_metadata'),
 ],
};
const versions={hq:hqVersion,gateway:gatewayVersion};
const deployments=which=>({deployments:[{
 id:'11111111-2222-4333-8444-555555555555',
 created_on:'2026-10-23T20:00:00Z',
 versions:[{version_id:versions[which],percentage:100}],
}]});
const readMetadata=async(which,mode)=>{
 if(mode==='version')return {
  id:versions[which],resources:{bindings:active[which]},
 };
 return deployments(which);
};
const orig=structuredClone(compiled);
orig.vars={
 ...orig.vars,JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
orig.secrets={required:[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
]};
const originalText=JSON.stringify(orig);
const off=()=>({
 hq:{enabled:true,previews_enabled:false},
 gateway:{enabled:true,previews_enabled:false},
});
const result=await preparePreviewLockedCandidate({
 compiled,original:orig,gatewayCandidate,
 readMetadata,readSubdomains:async()=>off(),
});
assert.equal(result.status,'HOLD');
assert.equal(result.only_changed_key,'preview_urls');
assert.equal(result.manifest.preview_urls,false);
assert.equal(result.manifest.workers_dev,true);
assert.equal(result.manifest.vars.JILL_WORK_CATALOG_ENABLED,'true');
assert.equal(result.manifest.vars.JILL_WORK_CONVERSATION_ENABLED,'false');
assert.equal(result.manifest.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED,'false');
assert.equal(result.manifest.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,'true');
assert.deepEqual(result.manifest.secrets,orig.secrets);
assert.equal(result.upload_or_deployment_authorized,false);
assert.equal(JSON.stringify(orig),originalText);
const root=mkdtempSync(join(tmpdir(),'jill-work-preview-locked-'));
try{
 const output=join(root,'wrangler.contact-owner-preview-disabled.json');
 const saved=writePreviewLockedLocal({
  manifest:result.manifest,original:orig,buildDir:root,output,
 });
 assert.equal(saved.status,'HOLD');
 assert.equal(saved.local_manifest_written,true);
 assert.equal(saved.worker_uploaded,false);
 assert.equal(saved.cloudflare_settings_changed,false);
 const disk=JSON.parse(readFileSync(output,'utf8'));
 assert.equal(disk.preview_urls,false);
 assert.equal(disk.workers_dev,true);
 assert.equal(disk.vars.JILL_WORK_OAUTH_ENABLED,'true');
 assert.match(saved.local_manifest_sha256,/^[a-f0-9]{64}$/);
 assert.throws(()=>writePreviewLockedLocal({
  manifest:result.manifest,original:orig,buildDir:root,output,
 }),/work_contact_preview_locked_local_existing_or_unsafe_output_path/);
 assert.throws(()=>writePreviewLockedLocal({
  manifest:{...result.manifest,vars:{
   ...result.manifest.vars,JILL_WORK_OAUTH_ENABLED:'false',
  }},original:orig,buildDir:root,output:join(root,'bad.json'),
 }),/work_contact_preview_locked_local_unexpected_changes_beyond_preview_urls/);
 assert.equal(existsSync(join(root,'bad.json')),false);
 assert.throws(()=>writePreviewLockedLocal({
  manifest:result.manifest,original:orig,buildDir:root,
  output:join(root,'..','unsafe.json'),
 }),/work_contact_preview_locked_local_existing_or_unsafe_output_path/);
}finally{rmSync(root,{force:true,recursive:true});}
for(const broken of [
 {hq:{enabled:true,previews_enabled:true},
  gateway:{enabled:true,previews_enabled:false}},
 {hq:{enabled:true,previews_enabled:false},
  gateway:{enabled:true,previews_enabled:true}},
 {hq:{enabled:false,previews_enabled:false},
  gateway:{enabled:true,previews_enabled:false}},
]){
 await assert.rejects(()=>preparePreviewLockedCandidate({
  compiled,original:orig,gatewayCandidate,
  readMetadata,readSubdomains:async()=>broken,
 }),/work_contact_preview_locked_local_public_preview_not_disabled/);
}
await assert.rejects(()=>preparePreviewLockedCandidate({
 compiled,original:{...orig,vars:{
  ...orig.vars,JILL_WORK_MERCHANT_WRITES_ENABLED:'false',
 }},gatewayCandidate,readMetadata,
 readSubdomains:async()=>off(),
}),/work_contact_artifact_attestation_candidate_not_equal_to_active/);
let previewReads=0;
await assert.rejects(()=>preparePreviewLockedCandidate({
 compiled,original:orig,gatewayCandidate,readMetadata,
 readSubdomains:async()=>{
  previewReads++;
  return previewReads===1?off():{
   ...off(),hq:{enabled:true,previews_enabled:true},
  };
 },
}),/work_contact_preview_locked_local_preview_settings_changed_during_attestation/);
assert.equal(previewReads,2);
let remoteReads=0;
await assert.rejects(()=>preparePreviewLockedCandidate({
 compiled,original:orig,gatewayCandidate,
 readMetadata:async(which,mode)=>{
  remoteReads++;
  if(which==='hq'&&mode==='version')
   return {id:hqVersion,resources:{bindings:[
    ...active.hq,b('JILL_WORK_CONTACT_INTAKE_ENABLED',
     'plain_text',{text:'true'}),
   ]}};
  return readMetadata(which,mode);
 },
 readSubdomains:async()=>off(),
}),/work_contact_binding_parity_contact_flag_runtime_not_off/);
assert.ok(remoteReads>0);
console.log('PASS WORK owner preview locked local-only: exact one-key manifest diff, full OAuth/flags/secrets parity, real preview GET OFF gate, no cloud writes, immutable original and refuses unsafe variants.');
