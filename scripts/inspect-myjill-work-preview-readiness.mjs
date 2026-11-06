// My JILL WORK preview gate. OFFLINE + READ ONLY.
// This intentionally cannot declare Shopify browser/account acceptance from
// a GitHub source build. No URL requests, subprocesses, writes or credentials.
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  assertRewardsWorkConfig,WORK_STORE,WORK_CONFIG_FILE,
} from './verify-rewards-work-target.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=(name)=>readFileSync(join(root,name),'utf8');
const exists=(name)=>existsSync(join(root,name));
const REQUIRED=[
  'extensions/jill-account-dashboard/src/Dashboard.jsx',
  'extensions/jill-account-dashboard/src/hub/AccountHub.jsx',
  'extensions/jill-account-dashboard/src/pages/Overview.jsx',
  'extensions/jill-account-dashboard/src/pages/RecentRequests.jsx',
  'extensions/jill-account-dashboard/src/pages/CustomOrders.jsx',
  'extensions/jill-account-dashboard/src/pages/Rewards.jsx',
  'extensions/jill-account-dashboard/src/pages/ContactConversationV2.jsx',
  'extensions/jill-account-dashboard/src/pages/ContactRequests.jsx',
  'shared/customer-contact-conversation-v2.mjs',
  'shared/customer-contact-draft-ledger.mjs',
  'scripts/prepare-account-hub-canary.mjs',
];
const CANNED_SCRIPT='node scripts/prepare-account-hub-canary.mjs --hub && '+
  'shopify app dev --path .work-account-canary --config work --store '+
  WORK_STORE;
const SIGNED_SCRIPT='node scripts/inspect-myjill-work-preview-readiness.mjs --require-local-work && '+
  'node scripts/prepare-account-hub-canary.mjs --read && '+
  'shopify app dev --path .work-account-canary --config work --store '+
  WORK_STORE;

export function inspectMyJillWorkPreview({linkedWorkConfig}={}){
 const missing=REQUIRED.filter(path=>!exists(path));
 const issues=[];
 if(missing.length)issues.push('required_source_missing');
 let flagsOff=false,canaryIsolated=false,previewCommandExact=false;
 let signedPreviewCommandExact=false,preflightCommandExact=false;
 if(!missing.length){
  const hub=read('extensions/jill-account-dashboard/src/hub/AccountHub.jsx');
  const canary=read('scripts/prepare-account-hub-canary.mjs');
  const pkg=JSON.parse(read('package.json'));
  const ignored=read('.gitignore');
  flagsOff=hub.includes("'contact-requests': <ContactRequests enabled={false}")&&
    !hub.includes("'contact-requests': <ContactRequests enabled={true}");
  if(!flagsOff)issues.push('contact_customer_feature_gate_unreviewed');
  canaryIsolated=canary.includes("assertRewardsWorkConfig(config)")&&
    canary.includes("const sentinel = '.jill-work-canary.json'")&&
    canary.includes('Refusing to delete an unrecognized preview directory.')&&
    ignored.includes('.work-account-canary/')&&
    ignored.includes(WORK_CONFIG_FILE);
  if(!canaryIsolated)issues.push('canary_source_isolation_unverified');
  previewCommandExact=
    pkg.scripts?.['rewards:work:hub:preview']===CANNED_SCRIPT;
  if(!previewCommandExact)issues.push('work_preview_command_unreviewed');
  preflightCommandExact=pkg.scripts?.['myjill:work:preview:preflight']===
    'node scripts/inspect-myjill-work-preview-readiness.mjs --require-local-work';
  signedPreviewCommandExact=
    pkg.scripts?.['myjill:work:preview:signed']===SIGNED_SCRIPT;
  if(!preflightCommandExact||!signedPreviewCommandExact)
    issues.push('signed_preview_command_unreviewed');
  // Existing --hub uses AccountHub without a signed account summary,
  // so it is a shell/layout smoke test ONLY; the signed WORK experience
  // requires the separate --read/ConnectedHub path.
  signedPreviewCommandExact=signedPreviewCommandExact&&
    canary.includes("(mode === 'read' || mode === 'template') ? 'ConnectedHub' : 'AccountHub'");
  if(!signedPreviewCommandExact)issues.push('connected_hub_mode_unverified');
 }else{
  issues.push('source_module_graph_incomplete');
 }
 let configState='missing';
 const hasSource=linkedWorkConfig!==undefined ||
   exists(WORK_CONFIG_FILE);
 if(hasSource){
  try{
   const data=linkedWorkConfig===undefined?read(WORK_CONFIG_FILE):
     linkedWorkConfig;
   const verified=assertRewardsWorkConfig(data,{requireHqName:true});
   if(verified.store!==WORK_STORE)throw Error('wrong store');
   configState='verified_work_app';
  }catch{configState='unverified';}
 }
 if(configState==='missing')issues.push('local_work_app_link_missing');
 if(configState==='unverified')issues.push('local_work_app_link_unverified');
 const sourceVerified=missing.length===0&&flagsOff&&
   canaryIsolated&&previewCommandExact&&
   preflightCommandExact&&signedPreviewCommandExact;
 const canPreparePreview=sourceVerified&&configState==='verified_work_app';
 return Object.freeze({
  operation:'jill.myjill.work.preview.readiness.v1',
  requested_shop:WORK_STORE,
  source_verified:sourceVerified,
  contact_replies_enabled:false,
  linked_work_app:configState,
  local_preview_prerequisites_met:canPreparePreview,
  shell_preview_only:true,
  connected_preview_source_verified:signedPreviewCommandExact,
  connected_work_account_session_started:false,
  owner_approved_launch_verified:false,
  real_shopify_browser_render_verified:false,
  customer_A_B_guest_verified:false,
  rewards_redemption_runtime_verified:false,
  legacy_account_certification_cleared:false,
  extension_published:false,
  cloudflare_deployment_performed:false,
  missing_source_count:missing.length,
  blockers:Object.freeze(issues),
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const result=inspectMyJillWorkPreview();
 console.log(JSON.stringify(result,null,2));
 if(process.argv.includes('--require-local-work')&&
   result.local_preview_prerequisites_met!==true)process.exitCode=2;
 else if(!result.source_verified)process.exitCode=1;
}
