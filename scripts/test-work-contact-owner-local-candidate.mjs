import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,existsSync,mkdirSync,rmSync,
 statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {planOwnerLocalContactCandidate,writeOwnerLocalManifest}
 from './prepare-work-contact-owner-local-candidate.mjs';
import {attestWorkContactLocalManifest,fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';
const compiledHq=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gatewayCandidate=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml','utf8');
const version={hq:'44ad4a81-55ad-4f49-9965-61260cc2294d',
 gateway:'9322193f-5e87-4479-88c9-39229dddb5f2'};
const b=(name,type,extra={})=>({name,type,...extra});
const hq=[
 b('JILL_ORDER_DESK_WORK_DB','d1',{
  id:'3f17c186-c794-4e00-8f20-017191373a19'}),
 b('JILL_WORK_HOST_STAGE','plain_text',{text:'canary'}),
 b('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','plain_text',{text:'false'}),
 b('JILL_WORK_OAUTH_ENABLED','plain_text',{text:'true'}),
 b('SHOPIFY_API_SECRET','secret_text'),
 b('JILL_WORK_SESSION_KEY_B64','secret_text'),
 b('JILL_HQ_MERCHANT_READ_SECRET','secret_text'),
 b('JILL_HQ_MERCHANT_WRITE_SECRET','secret_text'),
 b('JILL_WORK_CATALOG_ENABLED','plain_text',{text:'true'}),
 b('JILL_WORK_CONVERSATION_ENABLED','plain_text',{text:'false'}),
 b('JILL_WORK_HQ_DETAIL_ENABLED','plain_text',{text:'true'}),
 b('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','plain_text',{text:'true'}),
 b('JILL_WORK_MERCHANT_WRITES_ENABLED','plain_text',{text:'false'}),
];
const gateway=[
 b('RATE_LIMITER','durable_object_namespace'),
 b('SHOPIFY_WORK_APP_SECRET','secret_text'),
 b('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
 b('JILL_CUSTOM_ORDER_QA_BACKEND_URL','secret_text'),
 b('CF_VERSION_METADATA','version_metadata'),
];
const deployed=which=>({
 deployments:[{id:'11111111-2222-4333-8444-555555555555',
 created_on:'2026-10-23T20:00:00Z',
 versions:[{version_id:version[which],percentage:100}]}],
});
const view=which=>({
 id:version[which],resources:{bindings:which==='hq'?hq:gateway},
});
const original=JSON.stringify(compiledHq);
const audit=await planOwnerLocalContactCandidate({
 compiledHq,gatewayCandidate,
 readMetadata:async(which,mode)=>
  mode==='version'?view(which):deployed(which),
});
assert.equal(audit.report.status,'HOLD');
assert.equal(audit.report.active_versions_verified,true);
assert.equal(audit.report.gateway.gateway_secret_name_contract_matches_active,true);
assert.equal(audit.manifest.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(audit.manifest.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,'false');
assert.equal(audit.manifest.vars.JILL_WORK_CONVERSATION_ENABLED,'false');
assert.equal(audit.manifest.vars.JILL_WORK_CATALOG_ENABLED,'true');
assert.deepEqual(audit.manifest.secrets.required,[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
]);
assert.equal(JSON.stringify(compiledHq),original);
const dir=mkdtempSync(join(tmpdir(),'jill-contact-local-manifest-'));
try{
 const output=join(dir,'wrangler.contact-owner-local-only.json');
 const result=writeOwnerLocalManifest(audit.manifest,{
  buildDir:dir,output,
 });
 assert.equal(result.status,'HOLD');
 assert.equal(result.artifact_written_locally,true);
 assert.equal(result.upload_or_deployment_authorized,false);
 assert.equal(existsSync(output),true);
 const manifest=JSON.parse(readFileSync(output,'utf8'));
 assert.equal(manifest.vars.JILL_WORK_CATALOG_ENABLED,'true');
 assert.equal(manifest.secrets.required.length,4);
 if(process.platform!=='win32')
  assert.equal(statSync(output).mode&0o777,0o600);
 assert.throws(()=>writeOwnerLocalManifest(audit.manifest,{
  buildDir:dir,output,
 }),/work_contact_local_candidate_unsafe_or_existing_local_output/);
 assert.throws(()=>writeOwnerLocalManifest(audit.manifest,{
  buildDir:dir,output:join(dir,'..','escape.json'),
 }),/work_contact_local_candidate_unsafe_or_existing_local_output/);
 assert.throws(()=>writeOwnerLocalManifest({
  ...audit.manifest,
  d1_databases:[{...audit.manifest.d1_databases[0],database_id:'WRONG'}],
 },{buildDir:dir,output:join(dir,'bad.json')}),
 /work_contact_local_candidate_local_manifest_unverified/);
 assert.throws(()=>writeOwnerLocalManifest({
  ...audit.manifest,
  vars:{...audit.manifest.vars,JILL_WORK_CONTACT_INTAKE_ENABLED:'true'},
 },{buildDir:dir,output:join(dir,'unsafe-flag.json')}),
 /work_contact_local_candidate_contact_feature_not_off/);
 assert.equal(existsSync(join(dir,'unsafe-flag.json')),false);
 assert.throws(()=>writeOwnerLocalManifest({
  ...audit.manifest,
  vars:{...audit.manifest.vars,SHOPIFY_API_SECRET:'plaintext'},
 },{buildDir:dir,output:join(dir,'unsafe-secret.json')}),
 /work_contact_local_candidate_plaintext_secret_or_duplicate_name/);
 assert.equal(existsSync(join(dir,'unsafe-secret.json')),false);
 assert.equal(existsSync(join(dir,'bad.json')),false);
}finally{rmSync(dir,{recursive:true,force:true});}
await assert.rejects(()=>planOwnerLocalContactCandidate({
 compiledHq,gatewayCandidate,
 readMetadata:async(which,mode)=>
  which==='hq'&&mode==='version'
   ?{...view('hq'),resources:{bindings:[
      ...hq,b('JILL_WORK_UNREVIEWED_ENABLED','plain_text',{text:'true'}),
    ]}}
   :mode==='version'?view(which):deployed(which),
}),/work_contact_binding_parity_unreviewed_hq_plaintext_drift/);
await assert.rejects(()=>planOwnerLocalContactCandidate({
 compiledHq,gatewayCandidate,
 readMetadata:async(which,mode)=>
  which==='gateway'&&mode==='version'
   ?{...view('gateway'),resources:{bindings:gateway.filter(
      x=>x.name!=='JILL_CUSTOM_ORDER_QA_BACKEND_URL')}}
   :mode==='version'?view(which):deployed(which),
}),/work_contact_binding_parity_gateway_secret_names_do_not_match_active/);
// A new HQ deployment arriving after both initial inspections MUST stop
// candidate writing even if its version ID is coincidentally unchanged.
let deploymentReads=0;
await assert.rejects(()=>planOwnerLocalContactCandidate({
 compiledHq,gatewayCandidate,
 readMetadata:async(which,mode)=>{
  if(which==='hq'&&mode==='deployments'&&++deploymentReads===3){
   return {deployments:[{...deployed('hq').deployments[0],
    id:'88888888-9999-4000-8000-111111111111'}]};
  }
  return mode==='version'?view(which):deployed(which);
 },
}),/work_contact_local_candidate_paired_allocation_changed_after_inspection/);

const readSynthetic=async(which,mode)=>
 mode==='version'?view(which):deployed(which);
const cert=await attestWorkContactLocalManifest({
 compiled:compiledHq,candidate:audit.manifest,
 gatewayCandidate,readMetadata:readSynthetic,
});
assert.equal(cert.status,'HOLD');
assert.equal(cert.local_manifest_matches_active_reconciled_candidate,true);
assert.equal(cert.existing_hq_flag_count,5);
assert.equal(cert.required_hq_secret_name_count,4);
assert.equal(cert.release_authorized,undefined);
assert.equal(cert.secret_values_read,false);
await assert.rejects(()=>attestWorkContactLocalManifest({
 compiled:compiledHq,candidate:{...audit.manifest,vars:{
  ...audit.manifest.vars,JILL_WORK_CATALOG_ENABLED:'false',
 }},gatewayCandidate,readMetadata:readSynthetic,
}),/work_contact_artifact_attestation_candidate_not_equal_to_active/);
const checkDir=mkdtempSync(join(tmpdir(),'jill-local-evidence-'));
try{
 const server=join(checkDir,'dist','server');
 const client=join(checkDir,'dist','client');
 mkdirSync(join(server,'assets'),{recursive:true});
 mkdirSync(join(client,'assets'),{recursive:true});
 const output=join(server,'wrangler.contact-owner-local-only.json');
 writeFileSync(output,JSON.stringify(audit.manifest));
 writeFileSync(join(server,'index.js'),'export * from "./assets/worker-entry-test.js";');
 writeFileSync(join(server,'assets','worker-entry-test.js'),
  'export class JillContactPrivate {}');
 writeFileSync(join(server,'assets','server-build-test.js'),'export default {};');
 writeFileSync(join(client,'assets','app-test.js'),'console.log("synthetic");');
 const result=fingerprintLocalContactBuild({
  server,client,candidatePath:output,
 });
 assert.equal(result.status,'HOLD');
 assert.equal(result.private_worker_entry_found,true);
 assert.equal(result.bundled_file_count,5);
 assert.match(result.fingerprint_sha256,/^[a-f0-9]{64}$/);
 assert.match(result.manifest_sha256,/^[a-f0-9]{64}$/);
 const first=result.fingerprint_sha256;
 writeFileSync(join(server,'assets','server-build-test.js'),
  'export default {different:true};');
 assert.notEqual(fingerprintLocalContactBuild({
  server,client,candidatePath:output,
 }).fingerprint_sha256,first);
}finally{rmSync(checkDir,{recursive:true,force:true});}
console.log('PASS WORK Contact local-only owner parity candidate: pinned active OAuth, five preserved runtime flags, all secret names, 0600 artifact, rollback HOLD and no Cloudflare mutation.');
