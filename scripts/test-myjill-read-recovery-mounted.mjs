// Mount the real three request-history surfaces. Synthetic transport only;
// never contact Shopify or the WORK gateway from this test.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const extension=root+'extensions/jill-account-dashboard/';
const require=createRequire(extension+'package.json');
const {build}=createRequire(root+'package.json')('esbuild');
const {parseHTML}=createRequire(root+'tools/work-account-local/package.json')('linkedom');
const {document,window}=parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis,{document,window,HTMLElement:window.HTMLElement});
// Use the same ESM Preact instance as the bundled components and hooks.
const {render,h}=await import(pathToFileURL(require.resolve('preact').replace(/\.js$/,'.mjs')));
const {act}=await import(pathToFileURL(require.resolve('preact/test-utils').replace(/\.js$/,'.mjs')));
const output=extension+'.read-recovery-mounted-'+randomUUID()+'.mjs';
try{
 await build({stdin:{contents:`
  export {default as CustomOrders} from './src/pages/CustomOrders.jsx';
  export {default as RecentRequests} from './src/pages/RecentRequests.jsx';
  export {default as Messages} from './src/pages/Messages.jsx';`,
  resolveDir:extension},outfile:output,bundle:true,format:'esm',platform:'node',
  jsx:'automatic',jsxImportSource:'preact',external:['preact','preact/*']});
 const components=await import(pathToFileURL(output));
 const host=document.querySelector('main');
 const flush=async callback=>act(async()=>{callback();await new Promise(r=>setTimeout(r,25));});
 const responseFor=(title=null)=>new Response(JSON.stringify({version:1,
  operation:'custom_order.account.list.result',ok:true,reply_enabled:false,
  orders:title?[{submission_id:'jill:11111111-2222-4333-8444-555555555555',
   status:'received',revision:1,updated_at:'2026-10-22T16:00:00.000Z',
   summary:{items:[{title,quantity:1}],date_needed:'',fulfillment:'pickup'},
   timeline:[{status:'received',note:'Request received',occurred_at:'2026-10-22T16:00:00.000Z'}],
  }]:[],
 }));
 const button=(label)=>[...host.querySelectorAll('s-button')].find(x=>x.textContent.trim()===label);
 const click=(control)=>control.dispatchEvent(new window.Event('click',{bubbles:true}));
 const surfaces={
  RecentRequests:{empty:/Your next celebration starts here/,refresh:'Refresh activity'},
  CustomOrders:{empty:/No requests to show yet/,refresh:'Refresh updates'},
  Messages:{empty:/Nothing in your inbox yet/,refresh:'Refresh messages'},
 };
 for(const [name,Component] of Object.entries(components)){
  const {empty,refresh}=surfaces[name];
  const props={drafts:{},onNavigate:()=>{},onDraftsChange:()=>{}};
  globalThis.shopify={sessionToken:{get:async()=>'synthetic-session-proof'.repeat(3)}};
  globalThis.fetch=async()=>responseFor();
  await flush(()=>render(h(Component,props),host));
  await flush(()=>{});
  assert.match(host.textContent,empty,name+' renders the verified empty state');
  await flush(()=>render(null,host));

  for(const [status,expected] of [[429,/Wait a minute/],[401,/Sign out and sign back in/],
    [503,/temporarily unavailable/]]){
   let requests=0,tokens=0,purges=0;
   globalThis.shopify={sessionToken:{get:async()=>`synthetic-session-proof-${++tokens}`.repeat(3)}};
   globalThis.fetch=async(_url,{headers})=>{
    requests++;
    assert.equal(headers.Authorization,'Bearer '+`synthetic-session-proof-${requests}`.repeat(3));
    if(requests===1)return responseFor('Previously verified item');
    if(requests===2)return new Response('synthetic private upstream diagnostic',{status});
    return responseFor('Recovered verified item');
   };
   await flush(()=>render(h(Component,{...props,
    onDraftsChange:update=>{if(typeof update!=='function')purges++;}}),host));
   await flush(()=>{});
   assert.match(host.textContent,/Previously verified item/,name+' initially renders verified data');
   const refreshButton=button(refresh);
   assert.ok(refreshButton,name+' offers an explicit refresh');
   await flush(()=>click(refreshButton));
   await flush(()=>{});
   assert.match(host.textContent,expected,name+' presents actionable recovery');
   assert.equal(requests,2,name+' does not automatically repeat a failed read');
   assert.equal(tokens,2);
   assert.doesNotMatch(host.textContent,empty);
   assert.doesNotMatch(host.textContent,/Previously verified item|synthetic private upstream diagnostic/);
   if(name!=='RecentRequests')assert.equal(purges,1,name+' clears former account drafts');
   const retry=button('Try again');
   assert.ok(retry,name+' has an explicit retry');
   await flush(()=>click(retry));
   await flush(()=>{});
   assert.equal(requests,3,name+' retries only after customer action');
   assert.equal(tokens,3,name+' acquires a new token on retry');
   assert.match(host.textContent,/Recovered verified item/,name+' restores verified data');
   assert.doesNotMatch(host.textContent,expected);
   await flush(()=>render(null,host));
  }

  let finishOldRead,oldSignal;
  globalThis.fetch=(_url,{signal})=>{
   oldSignal=signal;
   return new Promise(resolve=>{finishOldRead=resolve;});
  };
  await flush(()=>render(h(Component,props),host));
  await flush(()=>{});
  assert.ok(finishOldRead,name+' starts the deferred read');
  await flush(()=>render(null,host));
  assert.ok(oldSignal.aborted,name+' aborts the old read when leaving');
  globalThis.fetch=async()=>responseFor('Current verified item');
  await flush(()=>render(h(Component,props),host));
  await flush(()=>{});
  await flush(()=>finishOldRead(responseFor('Obsolete verified item')));
  assert.match(host.textContent,/Current verified item/);
  assert.doesNotMatch(host.textContent,/Obsolete verified item/);
  await flush(()=>render(null,host));
 }
 console.log('PASS mounted Home, Custom Orders and Messages distinguish verified empty from failed refresh, recover on explicit retry, and fence obsolete reads after navigation.');
}finally{
 render(null,document.querySelector('main'));
 try{unlinkSync(output);}catch{}
 delete globalThis.fetch;
 delete globalThis.shopify;
}
