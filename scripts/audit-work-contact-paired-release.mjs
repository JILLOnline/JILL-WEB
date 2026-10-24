// WORK Contact Us paired-release contract — OFFLINE, audit-only.
// Hard HOLD until a separate approved, version-pinned WORK deployment.
// The checked-in HQ canary manifest has OAuth OFF even while active HQ
// runtime has OAuth ON. Blindly deploying that manifest is unsafe.
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SHOP='jill-work.myshopify.com';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const SERVICE='jill-order-desk-canary-work';
const BINDING='JILL_WORK_HQ_CONTACT_PRIVATE';
const ENTRY='JillContactPrivate';
const FLAGS=Object.freeze([
 'JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED',
 'JILL_WORK_CONTACT_INTAKE_ENABLED',
 'JILL_WORK_CONTACT_CLAIM_ENABLED',
 'JILL_WORK_CONTACT_ACCOUNT_ENABLED',
 'JILL_WORK_CONTACT_THREAD_ENABLED',
 'JILL_WORK_CONTACT_MESSAGES_ENABLED',
 'JILL_WORK_CONTACT_INBOX_ENABLED',
 'JILL_WORK_CONTACT_STATUS_ENABLED',
]);
const STOP=reason=>{throw Error('work_contact_paired_release_'+reason);};
const requireIt=(ok,reason)=>{if(!ok)STOP(reason);};
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const tomlSection=(data,label)=>{
 const match=[...data.matchAll(new RegExp('^\\[\\['+label+'\\]\\]$','gm'))];
 return match.length;
};
const tomlString=(data,key)=>
 [...data.matchAll(new RegExp('^'+key+'\\s*=\\s*"([^"\\r\\n]+)"\\s*$','gm'))]
 .map(m=>m[1]);
export function auditWorkContactReleaseSources({
 hqCanary,publicGateway,privateCandidate,hqWorker,gatewayHandler,
 storefront,
}={}){
 requireIt(hqCanary&&typeof hqCanary==='object'&&!Array.isArray(hqCanary),
  'hq_invalid');
 requireIt(hqCanary.name===SERVICE&&
  hqCanary.vars?.JILL_WORK_HOST_STAGE==='canary'&&
  hqCanary.vars?.JILL_WORK_OAUTH_ENABLED==='false'&&
  hqCanary.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false',
  'hq_default_manifest_not_safe_to_stage');
 requireIt(hqCanary.d1_databases?.length===1&&
  hqCanary.d1_databases[0].database_id===D1&&
  hqCanary.d1_databases[0].binding==='JILL_ORDER_DESK_WORK_DB'&&
  hqCanary.d1_databases[0].database_name==='jill-order-desk-work',
  'hq_d1_mismatch');
 requireIt(typeof publicGateway==='string'&&
  tomlString(publicGateway,'name').length===2&&
  tomlString(publicGateway,'name')[0]==='jill-work-custom-orders-qa'&&
  tomlSection(publicGateway,'services')===0&&
  tomlSection(publicGateway,'d1_databases')===0&&
  !publicGateway.includes(BINDING)&&
  !publicGateway.includes('JILL_ORDER_DESK_WORK_DB'),
  'public_gateway_scope_changed');
 requireIt(typeof privateCandidate==='string'&&
  tomlString(privateCandidate,'name').length===2&&
  tomlString(privateCandidate,'name')[0]==='jill-work-custom-orders-qa'&&
  tomlSection(privateCandidate,'services')===1&&
  tomlSection(privateCandidate,'d1_databases')===0&&
  tomlString(privateCandidate,'binding').length>=2&&
  tomlString(privateCandidate,'binding').filter(x=>x===BINDING).length===1&&
  tomlString(privateCandidate,'service').length===1&&
  tomlString(privateCandidate,'service')[0]===SERVICE&&
  tomlString(privateCandidate,'entrypoint').length===1&&
  tomlString(privateCandidate,'entrypoint')[0]===ENTRY&&
  tomlString(privateCandidate,'name').filter(x=>x==='RATE_LIMITER').length===1&&
  !privateCandidate.includes('JILL_ORDER_DESK_WORK_DB')&&
  !privateCandidate.includes('SHOPIFY_API_SECRET'),
  'private_candidate_scope_changed');
 // Preserve rate limiter, version metadata, Durable Object SQLite class
 // and ordinary gateway routes; do not enable a Contact feature in a manifest.
 for(const data of [JSON.stringify(hqCanary),publicGateway,privateCandidate]){
  requireIt(!FLAGS.some(f=>new RegExp('\\b'+f+'\\s*["=: ]+\\s*["\\x27]?true\\b','i').test(data)),
   'contact_flag_enabled_in_source_manifest');
 }
 requireIt(typeof hqWorker==='string'&&
  /export class JillContactPrivate extends WorkerEntrypoint/.test(hqWorker)&&
  /handleWorkContactPrivateBridge/.test(hqWorker)&&
  /export default \{/.test(hqWorker),
  'hq_private_entrypoint_missing');
 requireIt(typeof gatewayHandler==='string'&&
  gatewayHandler.includes("const service=env?.JILL_WORK_HQ_CONTACT_PRIVATE")&&
  gatewayHandler.includes("await service.fetch(forwarded)")&&
  gatewayHandler.includes("RATE_LIMITER")&&
  gatewayHandler.includes("return forwardContactToPrivateHq(request,env)")&&
  !gatewayHandler.includes('env?.JILL_ORDER_DESK_WORK_DB')&&
  !gatewayHandler.includes('env.JILL_ORDER_DESK_WORK_DB'),
  'gateway_not_isolated_from_d1');
 requireIt(typeof storefront==='string'&&
  storefront.includes('data-jill-work-contact-mode="off"')&&
  storefront.includes("form 'contact'")&&
  storefront.includes('data-jill-work-contact-endpoint="/apps/jill-custom-order/contact"'),
  'storefront_fallback_not_preserved');
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  shop:SHOP,
  default_hq_manifest_deploy_safe:false,
  reason:'checked_in_canary_manifest_OAuth_OFF_while_existing_WORK_OAuth_ON',
  standalone_gateway_manifest_no_private_access:true,
  distinct_unshipped_service_candidate:true,
  private_hq_entrypoint_source_present:true,
  rate_limit_boundary_source_present:true,
  native_shopify_contact_form_retained:true,
  contact_customer_flags_authorized:false,
  commissioned_service_binding:false,
  approved_customer_messages:false,
  deployment_performed:false,
  must_preserve_active_hq_bindings_and_secrets:true,
  no_live_keep_changes:true,
 });
}
export function loadAndAudit(){
 return auditWorkContactReleaseSources({
  hqCanary:JSON.parse(read('services/jill-order-desk/app-home/wrangler.canary.jsonc')),
  publicGateway:read('services/custom-order-cloudflare/wrangler.toml'),
  privateCandidate:read('services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml'),
  hqWorker:read('services/jill-order-desk/app-home/workers/app.ts'),
  gatewayHandler:read('services/custom-order-cloudflare/handler.mjs'),
  storefront:read('theme/sections/main-contact.liquid'),
 });
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{
  requireIt(process.argv.length===2,'unsupported_arguments');
  console.log(JSON.stringify(loadAndAudit(),null,2));
 }catch(error){
  console.error('HOLD '+(error?.message?.startsWith('work_contact_paired_release_')
   ?error.message:'work_contact_paired_release_unverifiable'));
  process.exitCode=1;
 }
}
