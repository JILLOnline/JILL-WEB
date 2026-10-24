// Offline WORK-only release planner. It compares an EXACT active Cloudflare
// versions-view metadata snapshot against a canary candidate. It NEVER
// deploys, writes, prints secret values or declares release authorization.
// Secret VALUE continuity is not attested by metadata and requires separate
// owner-approved inactive-upload verification before any traffic rollout.
import {prepareOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';

const D1='3f17c186-c794-4e00-8f20-017191373a19';
const HQ='jill-order-desk-canary-work';
const CONTACT=[
 'JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED',
 'JILL_WORK_CONTACT_INTAKE_ENABLED','JILL_WORK_CONTACT_ACCOUNT_ENABLED',
 'JILL_WORK_CONTACT_CLAIM_ENABLED','JILL_WORK_CONTACT_THREAD_ENABLED',
 'JILL_WORK_CONTACT_INBOX_ENABLED','JILL_WORK_CONTACT_STATUS_ENABLED',
 'JILL_WORK_CONTACT_MESSAGES_ENABLED',
];
const stop=reason=>{throw Error('work_contact_binding_parity_'+reason);};
const gate=(ok,reason)=>{if(!ok)stop(reason);};
const namesOnly=(view)=>{
 const bindings=view?.resources?.bindings;
 gate(Array.isArray(bindings)&&bindings.length>0&&bindings.length<=80,
  'missing_active_bindings');
 const map=new Map();
 for(const item of bindings){
  gate(typeof item?.name==='string'&&item.name.length>=2&&
   item.name.length<=128&&!map.has(item.name)&&
   typeof item.type==='string','malformed_active_bindings');
  map.set(item.name,item);
 }
 return map;
};
const activePlainValues=map=>{
 const vars={};
 for(const [key,binding] of map){
  if(binding.type!=='plain_text')continue;
  gate(typeof binding.text==='string'&&binding.text.length<=1024,
   'plain_text_value_missing');
  vars[key]=binding.text;
 }
 return vars;
};
const checkContactOff=map=>{
 for(const key of CONTACT){
  const b=map.get(key);
  gate(!b||(b.type==='plain_text'&&b.text==='false'),
   'contact_flag_runtime_not_off');
 }
};
export function prepareWorkContactOauthOnly(compiled){
 // The existing, individually tested manifest transformer creates an
 // OAuth-ON canary without touching any local or remote secret.
 const result=prepareOAuthManifest(compiled);
 gate(result.name===HQ&&result.vars.JILL_WORK_OAUTH_ENABLED==='true',
  'wrong_work_target');
 for(const key of CONTACT){
  gate(!Object.hasOwn(result.vars,key),'contact_flag_in_candidate');
 }
 gate(!result.services?.length,'unexpected_hq_service_binding');
 return result;
}
export function compareHqWorkContactCandidate({activeView,compiled}={}){
 const candidate=prepareWorkContactOauthOnly(compiled);
 const map=namesOnly(activeView);
 gate(map.get('JILL_ORDER_DESK_WORK_DB')?.type==='d1'&&
  [map.get('JILL_ORDER_DESK_WORK_DB').id,
   map.get('JILL_ORDER_DESK_WORK_DB').database_id].includes(D1),
  'active_d1_mismatch');
 gate([...map.values()].filter(x=>x.type==='d1').length===1,
  'unexpected_hq_d1');
 gate(map.get('SHOPIFY_API_SECRET')?.type==='secret_text'&&
  map.get('JILL_WORK_SESSION_KEY_B64')?.type==='secret_text',
  'missing_existing_auth_secrets');
 gate(map.get('JILL_WORK_HOST_STAGE')?.text==='canary'&&
  map.get('JILL_WORK_OAUTH_ENABLED')?.text==='true'&&
  map.get('JILL_WORK_OWNER_BOOTSTRAP_ENABLED')?.text==='false',
  'active_hq_auth_state_unknown');
 checkContactOff(map);
 const actual=activePlainValues(map);
 const target=candidate.vars;
 // Every active variable MUST be preserved, and no unreviewed variable
 // may be added. Otherwise the build is NOT safe to upload.
 const drift=[...new Set([...Object.keys(actual),...Object.keys(target)])]
  .filter(k=>actual[k]!==target[k]).sort();
 const unsupported=[...map.values()].filter(x=>!
  ['plain_text','secret_text','d1','version_metadata','assets'].includes(x.type))
  .map(x=>x.name).sort();
 return Object.freeze({
  environment:'WORK',target:HQ,status:'HOLD',
  oauth_preserved:drift.every(x=>x!=='JILL_WORK_OAUTH_ENABLED'),
  candidate_plaintext_parity:drift.length===0,
  missing_or_changed_plaintext_names:drift,
  unsupported_active_binding_names:unsupported,
  secret_names_present:true,secret_values_verified:false,
  canary_config_ready_for_upload:drift.length===0&&unsupported.length===0
   ? 'requires_separate_release_and_secret_continuity_approval':'NO',
  upload_or_deployment_authorized:false,
 });
}
export function compareGatewayWorkContactCandidate({activeView,
 candidateManifestText}={}){
 const map=namesOnly(activeView);
 gate(typeof candidateManifestText==='string'&&
  /^name = "jill-work-custom-orders-qa"$/m.test(candidateManifestText)&&
  /binding = "JILL_WORK_HQ_CONTACT_PRIVATE"/.test(candidateManifestText)&&
  /service = "jill-order-desk-canary-work"/.test(candidateManifestText)&&
  /entrypoint = "JillContactPrivate"/.test(candidateManifestText)&&
  !/\[\[d1_databases\]\]/.test(candidateManifestText),
  'gateway_candidate_target_drift');
 gate(!map.has('JILL_WORK_HQ_CONTACT_PRIVATE')&&
  ![...map.values()].some(x=>x.type==='d1'),
  'unexpected_live_gateway_private_d1_or_service');
 gate(map.get('RATE_LIMITER')?.type==='durable_object_namespace'&&
  map.get('SHOPIFY_WORK_APP_SECRET')?.type==='secret_text'&&
  map.get('JILL_CUSTOM_ORDER_GATEWAY_SECRET')?.type==='secret_text',
  'gateway_original_bindings_unverified');
 checkContactOff(map);
 // Existing Cloudflare WORK secret values remain hidden. Require the EXACT
 // currently attached secret binding NAMES in the unshipped TOML so Wrangler
 // can later fail closed if a credential was not inherited by an upload.
 const requiredMatch=candidateManifestText.match(
  /^\[secrets\]\r?\nrequired\s*=\s*\[([^\r\n]*)\]/m);
 gate(requiredMatch!==null,'gateway_secret_contract_missing');
 const names=requiredMatch[1].split(',').map(s=>s.trim());
 gate(names.every(n=>/^"[A-Z][A-Z0-9_]*"$/.test(n)),
  'gateway_secret_contract_invalid');
 const expectedNames=[...map].filter(([,b])=>b.type==='secret_text')
  .map(([key])=>key).sort();
 const declaredNames=names.map(n=>n.slice(1,-1)).sort();
 gate(expectedNames.length>0&&
  expectedNames.length===declaredNames.length&&
  expectedNames.every((n,i)=>n===declaredNames[i]),
  'gateway_secret_names_do_not_match_active');
 const plain=Object.keys(activePlainValues(map)).sort();
 const additionalBindings=[...map].filter(([name,b])=>!
  ['RATE_LIMITER','SHOPIFY_WORK_APP_SECRET',
   'JILL_CUSTOM_ORDER_GATEWAY_SECRET','CF_VERSION_METADATA'].includes(name))
  .map(([name])=>name).sort();
 return Object.freeze({
  environment:'WORK',target:'jill-work-custom-orders-qa',status:'HOLD',
  active_plaintext_names_to_preserve:plain,
  active_other_binding_names_to_preserve:additionalBindings,
  original_rate_limiter_and_secret_names_present:true,
  named_service_binding_in_candidate:true,
  gateway_secret_name_contract_matches_active:true,
  candidate_inherits_secrets_unverified:true,
  private_d1_in_gateway:false,
  upload_or_deployment_authorized:false,
 });
}

/**
 * Prepare a LOCAL, immutable WORK HQ manifest using only the five specifically
 * attested existing business flags. This does not ask Cloudflare to change
 * variables and cannot be used to infer authorization for a version upload.
 * Must be preceded by a 100%-traffic active version/identity pin.
 */
export const RESTORE_EXISTING_HQ_FLAGS=Object.freeze([
 'JILL_WORK_CATALOG_ENABLED',
 'JILL_WORK_CONVERSATION_ENABLED',
 'JILL_WORK_HQ_DETAIL_ENABLED',
 'JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED',
 'JILL_WORK_MERCHANT_WRITES_ENABLED',
]);
export function reconcileActiveHqContactManifest({activeView,compiled}={}){
 const sourceSnapshot=JSON.stringify(compiled);
 const before=compareHqWorkContactCandidate({activeView,compiled});
 gate(before.unsupported_active_binding_names.length===0,
  'unexpected_active_binding_type');
 const map=namesOnly(activeView);
 const existing=activePlainValues(map);
 const difference=before.missing_or_changed_plaintext_names;
 // Only exact known non-Contact business toggles may differ. Preserve their
 // actual string booleans; NEVER silently guess true or set new features ON.
 gate(difference.every(k=>RESTORE_EXISTING_HQ_FLAGS.includes(k))&&
  difference.every(k=>Object.hasOwn(existing,k))&&
  difference.every(k=>existing[k]==='true'||existing[k]==='false'),
  'unreviewed_hq_plaintext_drift');
 const base=prepareWorkContactOauthOnly(compiled);
 const next=structuredClone(base);
 const restored=[];
 for(const key of RESTORE_EXISTING_HQ_FLAGS){
  if(!Object.hasOwn(existing,key))continue;
  gate(existing[key]==='true'||existing[key]==='false',
   'unreviewed_hq_plaintext_value');
  gate(!Object.hasOwn(next.vars,key),'source_hq_flag_collision');
  next.vars[key]=existing[key];
  restored.push(key);
 }
 const result=compareHqWorkContactCandidate({activeView,compiled:{
  ...compiled,vars:{
   ...compiled.vars,
   // This is used for parity comparison only: prepareOAuthManifest
   // requires the source manifest to remain OAuth OFF.
   ...Object.fromEntries(restored.map(k=>[k,existing[k]])),
  },
 }});
 gate(result.candidate_plaintext_parity &&
  result.unsupported_active_binding_names.length===0,
  'reconciled_manifest_not_equal_to_active');
 gate(!CONTACT.some(k=>next.vars[k]==='true')&&
  next.vars.JILL_WORK_OAUTH_ENABLED==='true'&&
  next.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false',
  'contact_or_oauth_flag_drift');
 // Keep required secret NAMES only; Cloudflare can validate them upon
 // a separately authorized versions upload. Values are never retrieved.
 const required=[...map].filter(([,b])=>b.type==='secret_text')
  .map(([name])=>name).sort();
 gate(required.length>=2&&required.length<=60&&
  ['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64']
   .every(k=>required.includes(k)),
  'required_secret_names_missing');
 next.secrets={required};
 return Object.freeze({
  environment:'WORK',status:'HOLD',manifest:next,
  restored_existing_flag_names:restored,
  original_candidate_unchanged:JSON.stringify(compiled)===sourceSnapshot,
  required_existing_secret_names:required,
  secret_values_read:false,
  source_only:true,
  upload_or_deployment_authorized:false,
 });
}
