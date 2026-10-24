import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 evaluateWorkPreviewSettings,resolveExactWorkAccount,
 readExactCloudflarePreviewSettings,inspectWorkPreviewProtection,
} from './inspect-work-contact-preview-exposure-readonly.mjs';
const hq='44ad4a81-55ad-4f49-9965-61260cc2294d';
const gateway='9322193f-5e87-4479-88c9-39229dddb5f2';
const uuid='3f17c186-c794-4e00-8f20-017191373a19';
const binding=(name,type,rest={})=>({name,type,...rest});
const baseline={
 environment:'WORK',status:'HOLD',active_versions_verified:true,
 hq_active_version:hq,gateway_active_version:gateway,
 hq_reconciliation:{candidate_plaintext_parity_after_reconcile:true},
 gateway:{gateway_secret_name_contract_matches_active:true},
};
const states={
 hq:{enabled:true,previews_enabled:false},
 gateway:{enabled:true,previews_enabled:false},
};
const disabled=evaluateWorkPreviewSettings({baseline,subdomains:states});
assert.equal(disabled.status,'HOLD');
assert.equal(disabled.any_version_urls_enabled,false);
assert.equal(disabled.safe_for_unprotected_inactive_upload,true);
assert.equal(disabled.upload_authorized,false);
assert.equal(disabled.subdomain_settings_changed,false);
const publicPreview=evaluateWorkPreviewSettings({
 baseline,subdomains:{...states,hq:{enabled:true,previews_enabled:true}},
});
assert.equal(publicPreview.any_version_urls_enabled,true);
assert.equal(publicPreview.safe_for_unprotected_inactive_upload,false);
assert.equal(publicPreview.hq.preview_url_exposure,'POTENTIALLY_PUBLIC');
assert.equal(publicPreview.gateway.preview_url_exposure,'DISABLED');
for(const unsafe of [
 {...states,hq:{enabled:true}},
 {...states,gateway:{enabled:1,previews_enabled:false}},
 {...states,other:{enabled:true,previews_enabled:false}},
 {hq:states.hq},
]){
 assert.throws(()=>evaluateWorkPreviewSettings({
  baseline,subdomains:unsafe,
 }),/work_preview_guard_/);
}
assert.throws(()=>evaluateWorkPreviewSettings({
 baseline:{...baseline,active_versions_verified:false},
 subdomains:states,
}),/work_preview_guard_active_baseline_not_pinned/);
assert.throws(()=>evaluateWorkPreviewSettings({
 baseline:{...baseline,hq_active_version:gateway},
 subdomains:states,
}),/work_preview_guard_active_baseline_not_pinned/);
const account='0123456789abcdef0123456789abcdef';
const other='fedcba9876543210fedcba9876543210';
assert.equal(resolveExactWorkAccount({accounts:[{id:account}]}),account);
assert.equal(resolveExactWorkAccount({
 accounts:[{id:account},{id:other}],
},other),other);
assert.throws(()=>resolveExactWorkAccount({
 accounts:[{id:account},{id:other}],
}),/work_preview_guard_multiple_accounts_select_explicit_id/);
assert.throws(()=>resolveExactWorkAccount({
 accounts:[{id:account}],
},other),/work_preview_guard_selected_account_not_in_authenticated_memberships/);
const calls=[];
const token='synthetic-cloudflare-token-only-qa-12345';
const provider=await readExactCloudflarePreviewSettings({
 accountId:account,token,
 fetchImpl:async(url,options)=>{
  calls.push({url,method:options.method,auth:options.headers.Authorization});
  return new Response(JSON.stringify({
   success:true,errors:[],messages:[],result:{
    enabled:true,previews_enabled:url.includes('jill-order-desk')?
     false:true,secret_extra:'must_not_be_reported',
   },
  }),{status:200,headers:{'content-type':'application/json'}});
 },
});
assert.deepEqual(provider,{
 hq:{enabled:true,previews_enabled:false},
 gateway:{enabled:true,previews_enabled:true},
});
assert.equal(JSON.stringify(provider).includes('must_not_be_reported'),false);
assert.equal(calls.length,2);
assert.ok(calls.every(c=>c.method==='GET'&&
 c.url.startsWith('https://api.cloudflare.com/client/v4/accounts/'+account+
 '/workers/scripts/')&&c.auth==='Bearer '+token));
assert.deepEqual(calls.map(c=>new URL(c.url).pathname.split('/').at(-2)),[
 'jill-order-desk-canary-work','jill-work-custom-orders-qa']);
await assert.rejects(()=>readExactCloudflarePreviewSettings({
 accountId:account,token,
 fetchImpl:async()=>new Response(JSON.stringify({
  success:true,result:{enabled:true},
 }),{status:200}),
}),/work_preview_guard_cloudflare_subdomain_result_unverified/);
await assert.rejects(()=>readExactCloudflarePreviewSettings({
 accountId:account,token,
 fetchImpl:async()=>new Response('denied',{status:403}),
}),/work_preview_guard_cloudflare_subdomain_read_denied/);

const compiledHq=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gatewayCandidate=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml','utf8');
const flags=['JILL_WORK_CATALOG_ENABLED','JILL_WORK_CONVERSATION_ENABLED',
 'JILL_WORK_HQ_DETAIL_ENABLED','JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED',
 'JILL_WORK_MERCHANT_WRITES_ENABLED'];
const hqBindings=[
 binding('JILL_ORDER_DESK_WORK_DB','d1',{id:uuid}),
 binding('SHOPIFY_API_SECRET','secret_text'),
 binding('JILL_WORK_SESSION_KEY_B64','secret_text'),
 binding('JILL_HQ_MERCHANT_READ_SECRET','secret_text'),
 binding('JILL_HQ_MERCHANT_WRITE_SECRET','secret_text'),
 binding('JILL_WORK_HOST_STAGE','plain_text',{text:'canary'}),
 binding('JILL_WORK_OAUTH_ENABLED','plain_text',{text:'true'}),
 binding('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','plain_text',{text:'false'}),
 ...flags.map((name,i)=>binding(name,'plain_text',{text:i%2===0?'true':'false'})),
];
const gatewayBindings=[
 binding('RATE_LIMITER','durable_object_namespace'),
 binding('SHOPIFY_WORK_APP_SECRET','secret_text'),
 binding('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
 binding('JILL_CUSTOM_ORDER_QA_BACKEND_URL','secret_text'),
 binding('CF_VERSION_METADATA','version_metadata'),
];
const deployId='11111111-2222-4333-8444-555555555555';
const deployed=id=>({deployments:[{
 id:deployId,created_on:'2026-10-23T20:00:00Z',
 versions:[{version_id:id,percentage:100}],
}]});
const mock={
 hq:{deployments:deployed(hq),version:{
  id:hq,resources:{bindings:hqBindings}}},
 gateway:{deployments:deployed(gateway),version:{
  id:gateway,resources:{bindings:gatewayBindings}}},
};
const visited=[];
const whole=await inspectWorkPreviewProtection({
 compiledHq,gatewayCandidate,
 readMetadata:async(which,mode)=>{
  visited.push(which+':'+mode);
  return mock[which][mode];
 },
 readSubdomains:async()=>({...states}),
});
assert.equal(whole.status,'HOLD');
assert.equal(whole.safe_for_unprotected_inactive_upload,true);
assert.deepEqual(visited,[
 'hq:deployments','hq:version','hq:deployments',
 'gateway:deployments','gateway:version','gateway:deployments',
 'hq:deployments','gateway:deployments',
]);
let reads=0;
await assert.rejects(()=>inspectWorkPreviewProtection({
 compiledHq,gatewayCandidate,
 readMetadata:async(which,mode)=>{
  if(which==='hq'&&mode==='deployments'&&++reads===3){
   return deployed('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  }
  return mock[which][mode];
 },
 readSubdomains:async()=>({...states}),
}),/work_preview_guard_active_version_or_deployment_changed/);
console.log('PASS WORK Contact preview security: exact 2 GET-only settings, disabled vs public distinction, pinned active versions, token/redaction, unsupported/missing states HOLD.');
