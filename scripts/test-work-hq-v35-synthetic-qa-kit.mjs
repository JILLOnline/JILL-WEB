// OFFLINE fixture tests. No Chrome, Google, Shopify, Cloudflare, D1
// operation, synthetic request or customer data mutation occurs here.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {syntheticQuotePreflight} from './preflight-work-hq-v35-synthetic-qa.mjs';
import {ACTIVE,CANDIDATE,FALLBACK,SOURCE,WORKER}
  from './work-quote-v35-zero-deployment-policy.mjs';
import {MARKER} from './inspect-work-hq-quote-v35-readonly.mjs';
let n=0;
const pass=fn=>{fn();n++;};
const bad=async fn=>{await assert.rejects(fn);n++;};
const dir='tools/work-quote-v35-browser-pin/';
const manifest=JSON.parse(readFileSync(dir+'manifest.json','utf8'));
pass(()=>{
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.name,'JILL WORK v35 — Temporary Quote QA');
  assert.deepEqual(manifest.host_permissions,[
    'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/*']);
  assert.deepEqual(manifest.permissions,[
    'activeTab','declarativeNetRequest','alarms']);
  assert.deepEqual(manifest.background,{service_worker:'background.js'});
  assert.equal(manifest.action.default_popup,'popup.html');
  assert.equal('content_scripts' in manifest,false);
  assert.equal('web_accessible_resources' in manifest,false);
  assert.equal('externally_connectable' in manifest,false);
  assert.equal('declarative_net_request' in manifest,false);
});
const html=readFileSync(dir+'popup.html','utf8');
const popup=readFileSync(dir+'popup.js','utf8');
const bg=readFileSync(dir+'background.js','utf8');
for(const marker of [
  "VERSION=\"dbc6341f-de7f-41de-8e97-6bf971201eeb\"",
  "Cloudflare-Workers-Version-Overrides",
  "urlFilter:\"|https://\"+WORK+\"/\"",
  "tabIds:[current.id]",
  'getSessionRules()',
  'updateSessionRules({',
  '15*60*1000',
  'acceptedTab(current.url)',
  'chrome.alarms.create',
  "resourceTypes:[\"main_frame\",\"sub_frame\",\"xmlhttprequest\"",
]){
  assert.ok(popup.includes(marker),'Missing QA pin: '+marker);n++;
}
for(const marker of ['chrome.alarms.onAlarm','chrome.runtime.onStartup',
  'chrome.runtime.onInstalled','chrome.tabs.onRemoved',
  'removeRuleIds:[RULE]']){assert.ok(bg.includes(marker));n++;}
for(const unsafe of [
  /chrome\.storage/,
  /fetch\s*\(/,
  /localStorage/,
  /sessionStorage/,
  /document\.cookie/,
  /XMLHttpRequest/,
  /chrome\.cookies/,
  /https?:\/\/[^'"]*jillonlinestore\.com/,
  /<all_urls>/,
]){
  assert.doesNotMatch(popup+bg,unsafe);n++;
}
pass(()=>assert.ok(html.includes('Enable 15-minute QA')&&
  html.includes('Disable now')));
const buttons=new Map();
for(const k of ['enable','disable'])buttons.set('#'+k,{
  disabled:false,addEventListener(_event,fn){this.listener=fn;}});
buttons.set('#status',{textContent:''});
let activeTab={id:811,url:'https://admin.shopify.com/store/jill-work/apps/jill-hq'};
let rules=[],alarm=false,called=[];
const chrome={
  tabs:{query:async()=>[activeTab]},
  declarativeNetRequest:{
    getSessionRules:async()=>rules.slice(),
    async updateSessionRules({removeRuleIds,addRules=[]}){
      called.push('rule');
      rules=rules.filter(r=>!removeRuleIds.includes(r.id))
        .concat(addRules);
    },
  },
  alarms:{
    async create(name,opts){
      assert.equal(name,'jill-work-v35-qa-expire');
      assert.ok(Number.isFinite(opts.when));alarm=true;
    },
    async clear(name){assert.equal(name,'jill-work-v35-qa-expire');alarm=false;},
  },
};
const sandbox={
  document:{querySelector:id=>buttons.get(id)},
  chrome,URL,Date,Number,Error,String,
};
vm.runInNewContext(popup,sandbox,{timeout:2000});
await Promise.resolve();
await buttons.get('#enable').listener();
pass(()=>{
  assert.equal(rules.length,1);
  const rule=rules[0];
  assert.equal(rule.id,351);
  assert.equal(rule.action.type,'modifyHeaders');
  assert.equal(rule.action.requestHeaders[0].header,
    'Cloudflare-Workers-Version-Overrides');
  assert.equal(rule.action.requestHeaders[0].operation,'set');
  assert.equal(rule.action.requestHeaders[0].value,
    WORKER+'="'+CANDIDATE+'"');
  assert.equal(rule.condition.tabIds[0],811);
  assert.equal(rule.condition.tabIds.length,1);
  assert.equal(rule.condition.urlFilter,
    '|https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/');
  assert.ok(rule.condition.resourceTypes.includes('xmlhttprequest'));
  assert.ok(rule.condition.resourceTypes.includes('sub_frame'));
  assert.equal(alarm,true);
});
await buttons.get('#disable').listener();
pass(()=>{assert.equal(rules.length,0);assert.equal(alarm,false);});
for(const raw of [
  'https://jillonlinestore.com/admin',
  'https://jill-work.myshopify.com/',
  'https://admin.shopify.com/store/other-store/apps',
  'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev.evil.test/',
  'http://admin.shopify.com/store/jill-work/apps/',
]){
  activeTab={id:811,url:raw};
  await buttons.get('#enable').listener();
  pass(()=>{assert.equal(rules.length,0);assert.equal(alarm,false);});
}
const b=(name,text)=>({name,type:'plain_text',text});
const flags=[
  b('JILL_WORK_HOST_STAGE','canary'),
  b('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','false'),
  b('JILL_WORK_OAUTH_ENABLED','true'),
  b('JILL_WORK_HQ_DETAIL_ENABLED','true'),
  b('JILL_WORK_MERCHANT_WRITES_ENABLED','true'),
];
const original=[
  ...flags,
  ...['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
    'JILL_HQ_MERCHANT_READ_SECRET',
    'JILL_HQ_MERCHANT_WRITE_SECRET'].map(name=>({
      name,type:'secret_text',
    })),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',
    id:'3f17c186-c794-4e00-8f20-017191373a19'},
];
const runtime={
  compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],
  exports:{default:['fetch']},
  assets:{html_handling:'auto-trailing-slash',
    not_found_handling:'none',run_worker_first:false,revision_id:'old'},
};
const versions=[
  {id:FALLBACK,metadata:{created_on:'2026-10-13T00:00:00Z'},
    resources:{script:{etag:'fallback'}}},
  {id:ACTIVE,metadata:{created_on:'2026-10-14T00:00:00Z'},
    resources:{bindings:original,script:{etag:'old',handlers:['fetch']},
      script_runtime:runtime}},
  {id:CANDIDATE,metadata:{created_on:'2026-10-17T17:00:00Z'},
    annotations:{'workers/message':MARKER},
    resources:{bindings:[...original,b(
      'JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','true')],
      script:{etag:'new',handlers:['fetch']},
      script_runtime:{...runtime,assets:{...runtime.assets,
        revision_id:'new'}}}},
];
const dep='11111111-1111-4111-8111-111111111111';
const deployment=[{id:dep,created_on:'2026-10-17T18:00:00Z',
  versions:[{version_id:ACTIVE,percentage:100},
    {version_id:CANDIDATE,percentage:0}]}];
const status='Version(s): (100%) 4973b74d-d479-41da-897c-e36129303279';
const qa={
  deploymentFound:true,headMatchesCertifiedGit:true,
  publishedRevisionVerified:true,publishedVersion:7,
  publishedDigest:'a'.repeat(64),
};
const metadata={status:()=>status,deployments:()=>deployment,
  versions:()=>versions,version:id=>versions.find(v=>v.id===id)};
const config={
  qaAudit:async()=>qa,metadata,probe:async()=>true,
  verifyCheckout:()=>{},
};
pass(()=>assert.equal(SOURCE,
  '4e4acfcc56e8b3ecb558fc7e10c80301f1cc0d9b'));
const ok=await syntheticQuotePreflight(config);
pass(()=>{
  assert.equal(ok.work_v34_pct,100);
  assert.equal(ok.work_v35_pct,0);
  assert.equal(ok.qa_published_version,7);
  assert.equal(ok.synthetic_submission_created,false);
  assert.equal(ok.quote_draft_saved,false);
  assert.equal(ok.anonymous_version_override_owner_denial,true);
});
await bad(()=>syntheticQuotePreflight({...config,
  qaAudit:async()=>({...qa,publishedRevisionVerified:false})}));
await bad(()=>syntheticQuotePreflight({...config,
  qaAudit:async()=>({...qa,publishedDigest:'invalid'})}));
await bad(()=>syntheticQuotePreflight({...config,
  metadata:{...metadata,status:()=>FALLBACK+' (100%)'}}));
await bad(()=>syntheticQuotePreflight({...config,
  metadata:{...metadata,deployments:()=>[{
    ...deployment[0],
    versions:[{version_id:ACTIVE,percentage:99},
      {version_id:CANDIDATE,percentage:1}],
  }]}}));
await bad(()=>syntheticQuotePreflight({...config,
  metadata:{...metadata,version:id=>id===CANDIDATE?
    {...versions[2],annotations:{}}:metadata.version(id)}}));
await bad(()=>syntheticQuotePreflight({...config,probe:async()=>{
  throw Error('v35_override_not_proven');
}}));
await bad(()=>syntheticQuotePreflight({...config,verifyCheckout:()=>{
  throw Error('not_synced');
}}));
console.log('PASS WORK synthetic quote browser QA kit OFFLINE: '+
  n+' manifest, one-tab temporary version rule, expiration, QA published pin, known 100/0 allocation and fail-closed source checks.');
console.log('HOLD: no actual QA order creation, signed-in browser test, remote D1 quote write, Worker deployment or customer communication by CI.');
