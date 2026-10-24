// WORK Contact release: source-only Version URL lockdown proposal.
// Must NOT change Cloudflare subdomain settings, active manifests, routing,
// customer sessions, paid plans or the owner-attested local build bytes.
// The original SHA-256 evidence remains valid for its ORIGINAL candidate.
// Any changed prospective artifact requires a new build/hash/attestation.
import {createHash} from 'node:crypto';

const HQ='jill-order-desk-canary-work';
const GATEWAY='jill-work-custom-orders-qa';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const SECRETS=[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const STOP=r=>{throw Error('work_contact_preview_lockdown_'+r);};
const check=(ok,r)=>{if(!ok)STOP(r);};
const digest=o=>createHash('sha256')
 .update(JSON.stringify(o)).digest('hex');
export const REVIEWED_WORK_PREVIEW_FLAGS=Object.freeze({
 hq:HQ,gateway:GATEWAY,
});
export function proposeHqPreviewDisabledManifest(original){
 check(original&&typeof original==='object'&&!Array.isArray(original)&&
  original.name===HQ&&original.workers_dev===true&&
  original.preview_urls!==true,'hq_scope_or_preview_conflict');
 const db=original.d1_databases;
 check(Array.isArray(db)&&db.length===1&&
  db[0]?.binding==='JILL_ORDER_DESK_WORK_DB'&&
  db[0]?.database_id===D1,'hq_private_work_d1_changed');
 check(original.vars?.JILL_WORK_HOST_STAGE==='canary'&&
  original.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false'&&
  original.vars?.JILL_WORK_OAUTH_ENABLED==='true'&&
  !Object.keys(original.vars??{}).some(k=>
   k.startsWith('JILL_WORK_CONTACT_')&&original.vars[k]!=='false'),
  'hq_oauth_or_contact_scope_unsafe');
 check(Array.isArray(original.secrets?.required)&&
  original.secrets.required.length===SECRETS.length&&
  [...original.secrets.required].sort().every((v,i)=>
   v===[...SECRETS].sort()[i]),'hq_secret_names_changed');
 check(!original.services?.length,'hq_unexpected_service_binding');
 const unchanged=JSON.stringify(original);
 const manifest=structuredClone(original);
 manifest.preview_urls=false;
 // The change must be exactly one setting. Everything else remains
 // bytewise stable under canonical JSON comparison.
 const comparison=structuredClone(manifest);
 if(Object.hasOwn(original,'preview_urls'))
  comparison.preview_urls=original.preview_urls;
 else
  delete comparison.preview_urls;
 check(JSON.stringify(comparison)===unchanged,
  'prospective_manifest_contains_other_changes');
 return Object.freeze({
  status:'HOLD',target:HQ,
  original_digest:digest(original),
  proposed_digest:digest(manifest),
  changed_keys:Object.freeze(['preview_urls']),
  would_keep_workers_dev:true,
  would_disable_version_urls:true,
  release_authorized:false,
  manifest, // for isolated synthetic compile; NEVER sent to Cloudflare
 });
}
export function reviewPairedPreviewLockdown({
 subdomains,hqOriginal,hqProposed,gatewayCandidate,
}={}){
 check(subdomains&&typeof subdomains==='object'&&
  Object.keys(subdomains).length===2&&
  ['hq','gateway'].every(k=>Object.hasOwn(subdomains,k)),
  'current_preview_observation_missing');
 for(const name of ['hq','gateway']){
  check(subdomains[name]&&
   subdomains[name].enabled===true&&
   typeof subdomains[name].previews_enabled==='boolean',
   'workers_dev_or_preview_state_unknown');
 }
 const proposed=proposeHqPreviewDisabledManifest(hqOriginal);
 check(hqProposed&&JSON.stringify(hqProposed)===
  JSON.stringify(proposed.manifest),
  'hq_lockdown_diff_unapproved');
 check(typeof gatewayCandidate==='string'&&
  (gatewayCandidate.match(/^workers_dev = true$/gm)??[]).length===1&&
  (gatewayCandidate.match(/^preview_urls = false$/gm)??[]).length===1&&
  /^name = "jill-work-custom-orders-qa"$/m.test(gatewayCandidate)&&
  /binding = "JILL_WORK_HQ_CONTACT_PRIVATE"/.test(gatewayCandidate)&&
  /entrypoint = "JillContactPrivate"/.test(gatewayCandidate)&&
  !/\[\[d1_databases\]\]/.test(gatewayCandidate),
  'gateway_preview_candidate_unverified');
 const exposed=['hq','gateway'].filter(k=>
  subdomains[k].previews_enabled);
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  hq_worker:HQ,gateway_worker:GATEWAY,
  version_urls_currently_enabled_on:exposed,
  current_preview_exposure_gate_cleared:exposed.length===0,
  proposed_hq_preview_urls:false,
  proposed_gateway_preview_urls:false,
  keep_both_workers_dev_routes:true,
  configuration_changes_performed:false,
  paid_services_enabled:false,
  upload_or_deployment_authorized:false,
  requires_explicit_setting_change_authorization:exposed.length>0,
  requires_new_artifact_fingerprint:true,
  current_original_artifact_fingerprint_still_original_only:true,
 });
}
