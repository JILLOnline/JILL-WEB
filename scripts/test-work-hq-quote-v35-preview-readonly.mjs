// No network! Synthetic response contract for GET-only host-pin smoke.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectQuoteV35Preview as inspect,CANONICAL,VERSION_URL}
  from './audit-work-hq-quote-v35-preview-readonly.mjs';
let cases=0;
const deny=async f=>{
  await assert.rejects(f,/^Error: quote_v35_preview_/);
  cases++;
};
const make=(status,error,opts={})=>new Response(
  JSON.stringify(opts.payload??{ok:false,error}),
  {status,headers:{'content-type':opts.contentType??'application/json',
    'cache-control':opts.cache??'private, no-store, max-age=0'}});
const good=async(u,opts)=>{
  assert.equal(opts.method,'GET');
  assert.equal(opts.credentials,'omit');
  assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.accept,'application/json');
  assert.ok(!opts.headers.authorization&&!opts.headers.cookie);
  if(u===VERSION_URL+'/healthz')return make(421,'wrong_host');
  if(u===CANONICAL+'/app/requests/quote-draft')
    return make(503,'quote_drafts_not_enabled');
  throw Error('unexpected_url');
};
const pass=await inspect({request:good});
assert.equal(pass.preview_hostname_enforced,true);
assert.equal(pass.active_v34_quote_route_locked,true);
assert.equal(pass.v35_authenticated_flow_tested,false);
assert.equal(pass.candidate_byte_parity_proven,false);
assert.equal(pass.deployment_permission_granted,false);
assert.equal(pass.traffic_changed,false);
cases++;
for(const change of [
  {status:200},
  {status:404},
  {status:503},
  {status:421,error:'some_other_error'},
  {status:421,error:'wrong_host',contentType:'text/html'},
  {status:421,error:'wrong_host',cache:'public, max-age=60'},
  {status:421,error:'wrong_host',payload:{ok:true,error:'wrong_host'}},
  {status:421,error:'wrong_host',payload:{ok:false,error:'wrong_host',customer:'leaked'}},
]){
  await deny(()=>inspect({request:async(u)=>{
    if(u===VERSION_URL+'/healthz')return make(
      change.status,change.error||'wrong_host',change);
    return make(503,'quote_drafts_not_enabled');
  }}));
}
for(const change of [
  {status:200,error:'wrong_host'},
  {status:421,error:'wrong_host'},
  {status:503,error:'shopify_auth_not_configured'},
  {status:503,error:'quote_drafts_not_enabled',
    payload:{ok:false,error:'quote_drafts_not_enabled',customer:'x'}},
]){
  await deny(()=>inspect({request:async(u)=>{
    if(u===VERSION_URL+'/healthz')return make(421,'wrong_host');
    return make(change.status,change.error,change);
  }}));
}
await deny(()=>inspect({request:null}));
const source=readFileSync(new URL('./audit-work-hq-quote-v35-preview-readonly.mjs',
  import.meta.url),'utf8');
for(const marker of [
  "V35.slice(0,8)",
  "expectedStatus:421,expectedCode:'wrong_host'",
  "expectedStatus:503,expectedCode:'quote_drafts_not_enabled'",
  "credentials:'omit'",
  "redirect:'manual'",
  "method:'GET'",
  "0% deployment + version override needs separate authorization",
  "traffic_changed:false",
]){
  assert.ok(source.includes(marker),'Missing preview safety contract: '+marker);
  cases++;
}
for(const unsafe of [
  /['"]POST['"]/,
  /versions','deploy/,
  /versions','upload/,
  /rollback\(/,
  /secret','put/,
  /D1\.prepare/,
]){
  assert.doesNotMatch(source,unsafe);
  cases++;
}
console.log('PASS WORK v35 version-URL safe preview OFFLINE: '+
  cases+' strict response, wrong-host, canonical v34 locked, no-traffic/PII tests.');
console.log('HOLD: HTTP preview in Cloudflare still needs Owner Windows run; 0% deployment requires distinct Owner approval.');
