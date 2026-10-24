import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewCombinedWorkContactEvidence}
 from './review-work-contact-combined-evidence-readonly.mjs';

const hqVersion='44ad4a81-55ad-4f49-9965-61260cc2294d';
const gwVersion='9322193f-5e87-4479-88c9-39229dddb5f2';
const compiledHq=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gatewayCandidate=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml',
 'utf8');
const localManifest=structuredClone(compiledHq);
localManifest.vars={
 ...localManifest.vars,
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
localManifest.preview_urls=false;
localManifest.secrets={required:[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
]};
const localArtifact={
 fingerprint_sha256:'c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996',
 manifest_sha256:'890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671',
 bundled_file_count:50,private_worker_entry_found:true,
};
const bind=(name,type,extra={})=>({name,type,...extra});
const active={
 hq:[
  bind('JILL_ORDER_DESK_WORK_DB','d1',{
   id:'3f17c186-c794-4e00-8f20-017191373a19'}),
  ...localManifest.secrets.required.map(name=>bind(name,'secret_text')),
  ...Object.entries(localManifest.vars).map(([name,text])=>
   bind(name,'plain_text',{text})),
 ],
 gateway:[
  bind('RATE_LIMITER','durable_object_namespace'),
  ...[
   'SHOPIFY_WORK_APP_SECRET','JILL_CUSTOM_ORDER_GATEWAY_SECRET',
   'JILL_CUSTOM_ORDER_QA_BACKEND_URL',
  ].map(name=>bind(name,'secret_text')),
  bind('CF_VERSION_METADATA','version_metadata'),
 ],
};
const id={hq:hqVersion,gateway:gwVersion};
const deployment=which=>({deployments:[{
 id:which==='hq'?'f80335de-98ea-4831-b00e-87cd1a397596':
  '4fad4b6f-3596-4797-83a3-05edb7f89097',
 created_on:'2026-10-23T20:00:00Z',
 versions:[{version_id:id[which],percentage:100}],
}]});
const safeSubdomains=()=>({
 hq:{enabled:true,previews_enabled:false},
 gateway:{enabled:true,previews_enabled:false},
});
function scenario(overrides={}){
 const calls={local:0,meta:[],preview:0};
 const readLocal=async()=>{
  calls.local++;
  const copy={manifest:structuredClone(localManifest),
   artifact:structuredClone(localArtifact)};
  return overrides.local?overrides.local(copy,calls.local):copy;
 };
 const readMetadata=async(which,mode)=>{
  calls.meta.push(which+':'+mode);
  const original=mode==='deployments'?deployment(which):
   {id:id[which],resources:{bindings:structuredClone(active[which])}};
  return overrides.meta?overrides.meta(which,mode,calls.meta.length,original):
   original;
 };
 const readSubdomains=async()=>{
  calls.preview++;
  const original=safeSubdomains();
  return overrides.preview?overrides.preview(original,calls.preview):original;
 };
 return {
  calls,
  run:()=>reviewCombinedWorkContactEvidence({
   readLocal,readMetadata,readSubdomains,
   compiledHq,gatewayCandidate:overrides.gatewayCandidate??gatewayCandidate,
  }),
 };
}
const good=scenario();
const verified=await good.run();
assert.equal(verified.status,'HOLD');
assert.equal(verified.local_artifact_matches_owner_pin,true);
assert.equal(verified.active_binding_names_and_plaintext_parity_verified,true);
assert.equal(verified.remote_preview_settings_gets_per_worker,2);
assert.equal(verified.hq_version_urls_enabled,false);
assert.equal(verified.gateway_version_urls_enabled,false);
assert.equal(verified.normal_traffic_observed_unchanged,true);
assert.equal(verified.hq_active_version,hqVersion);
assert.equal(verified.gateway_active_version,gwVersion);
assert.equal(verified.inactive_upload_authorized,false);
assert.equal(verified.readiness_certificate_issued,false);
assert.equal(verified.free_tier_budget_verified,false);
assert.equal(verified.remote_secret_value_continuity_verified,false);
assert.equal(verified.source_provenance_verified,false);
assert.equal(verified.worker_uploaded,false);
assert.equal(verified.worker_deployed,false);
assert.equal(verified.normal_traffic_changed,false);
assert.equal(verified.customer_data_read,false);
assert.equal(verified.secret_values_read,false);
assert.equal(good.calls.local,2);
assert.equal(good.calls.preview,2);
assert.deepEqual(good.calls.meta,[
 'hq:deployments','hq:version','hq:deployments',
 'gateway:deployments','gateway:version','gateway:deployments',
 'hq:deployments','gateway:deployments',
 'hq:deployments','gateway:deployments',
]);
assert.equal(JSON.stringify(verified).includes('SHOPIFY_API_SECRET'),false);
assert.equal(JSON.stringify(verified).includes('JILL_WORK_SESSION_KEY_B64'),false);

const badHash=scenario({local:c=>{
 c.artifact.manifest_sha256='0'.repeat(64);return c;
}});
await assert.rejects(badHash.run(),
 /contact_inactive_upload_offline_owner_pinned_local_bytes_changed/);
assert.equal(badHash.calls.meta.length,0);
assert.equal(badHash.calls.preview,0);

const badGateway=scenario({gatewayCandidate:gatewayCandidate.replace(
 'preview_urls = false','preview_urls = true')});
await assert.rejects(badGateway.run(),
 /work_contact_combined_review_gateway_preview_manifest_not_locked/);
assert.equal(badGateway.calls.meta.length,0);

for(const unsafe of [
 s=>{s.hq.previews_enabled=true;},
 s=>{s.gateway.previews_enabled=true;},
 s=>{s.hq.enabled=false;},
 s=>{delete s.gateway.previews_enabled;},
]){
 const trial=scenario({preview:unsafe===null?undefined:(s)=>{
  unsafe(s);return s;
 }});
 await assert.rejects(trial.run(),/work_contact_combined_review_/);
}
const previewDrift=scenario({preview:(s,n)=>{
 if(n===2)s.hq.previews_enabled=true;
 return s;
}});
await assert.rejects(previewDrift.run(),
 /work_contact_combined_review_preview_settings_changed_during_review/);
assert.equal(previewDrift.calls.preview,2);

const trafficDrift=scenario({meta:(which,mode,n,original)=>{
 if(which==='hq'&&mode==='deployments'&&n===7)
  original.deployments[0].id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 return original;
}});
await assert.rejects(trafficDrift.run(),
 /work_contact_combined_review_deployment_changed_hq/);
const finalTrafficDrift=scenario({meta:(which,mode,n,original)=>{
 if(which==='gateway'&&mode==='deployments'&&n===10)
  original.deployments[0].versions[0].version_id=
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 return original;
}});
await assert.rejects(finalTrafficDrift.run(),
 /work_contact_combined_review_deployment_changed_final_gateway/);
const localDrift=scenario({local:(c,n)=>{
 if(n===2)c.artifact.fingerprint_sha256='0'.repeat(64);
 return c;
}});
await assert.rejects(localDrift.run(),
 /contact_inactive_upload_offline_owner_pinned_local_bytes_changed/);
assert.equal(localDrift.calls.local,2);

const removedSecret=scenario({meta:(which,mode,n,original)=>{
 if(which==='hq'&&mode==='version')
  original.resources.bindings=original.resources.bindings.filter(
   b=>b.name!=='SHOPIFY_API_SECRET');
 return original;
}});
await assert.rejects(removedSecret.run(),/work_contact_/);
const enabledRemoteFlag=scenario({meta:(which,mode,n,original)=>{
 if(which==='hq'&&mode==='version')
  original.resources.bindings.push(bind(
   'JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED','plain_text',{text:'true'}));
 return original;
}});
await assert.rejects(enabledRemoteFlag.run(),/work_contact_/);
const differentOAuth=scenario({meta:(which,mode,n,original)=>{
 if(which==='hq'&&mode==='version')
  original.resources.bindings=original.resources.bindings.map(b=>
   b.name==='JILL_WORK_OAUTH_ENABLED'?{...b,text:'false'}:b);
 return original;
}});
await assert.rejects(differentOAuth.run(),/work_contact_/);

console.log('PASS WORK combined release review: pinned local digest, repeated authenticated-preview source contract, active version/binding gates, drift and mutation rejection, no write authorization.');
