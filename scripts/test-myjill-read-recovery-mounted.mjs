// Mount the real request-history surfaces and their account hub. Synthetic transport only;
// never contact Shopify or the WORK gateway from this test.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {CUSTOMER_ACCOUNT_API,ACCOUNT_HUB_SUMMARY_QUERY} from '../shared/customer-account-api.mjs';
import {WORK_CUSTOM_ORDER_ACCOUNT_URL} from '../shared/customer-custom-orders.mjs';
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
  export {default as Messages} from './src/pages/Messages.jsx';
  export {default as ConnectedHub} from './src/hub/ConnectedHub.jsx';`,
  resolveDir:extension},outfile:output,bundle:true,format:'esm',platform:'node',
  jsx:'automatic',jsxImportSource:'preact',external:['preact','preact/*']});
 const {ConnectedHub,...components}=await import(pathToFileURL(output));
 const host=document.querySelector('main');
 const flush=async callback=>act(async()=>{callback();await new Promise(r=>setTimeout(r,25));});
 const firstId='jill:11111111-2222-4333-8444-555555555555';
 const firstEvent={status:'received',note:'Request received',occurred_at:'2026-10-22T16:00:00.000Z'};
 const responseFor=(title=null,{id=firstId,update=null}={})=>new Response(JSON.stringify({version:1,
  operation:'custom_order.account.list.result',ok:true,reply_enabled:false,
  orders:title?[{submission_id:id,status:update?.status??firstEvent.status,
   revision:update?2:1,updated_at:update?.occurred_at??firstEvent.occurred_at,
   summary:{items:[{title,quantity:1}],date_needed:'',fulfillment:'pickup'},
   timeline:update?[firstEvent,update]:[firstEvent],
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
  let emptyStateReads=0;
  globalThis.fetch=async()=>responseFor(++emptyStateReads===1?null:'Newly verified request');
  await flush(()=>render(h(Component,props),host));
  await flush(()=>{});
  assert.match(host.textContent,empty,name+' renders the verified empty state');
  assert.equal(emptyStateReads,1,name+' waits for customer action');
  const refreshEmpty=button(refresh);
  assert.ok(refreshEmpty,name+' offers refresh from the verified empty state');
  await flush(()=>click(refreshEmpty));
  await flush(()=>{});
  assert.equal(emptyStateReads,2,name+' refresh issues exactly one read');
  assert.match(host.textContent,/Newly verified request/);
  assert.doesNotMatch(host.textContent,empty);
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

 const {CustomOrders}=components;
 const props={drafts:{},onNavigate:()=>{},onDraftsChange:()=>{}};
 const update={status:'reviewing',note:'Synthetic HQ status note',occurred_at:'2026-10-22T17:00:00.000Z'};
 const secondId='jill:22222222-3333-4444-8555-666666666666';
 let orderResponse=()=>responseFor('First request');
 globalThis.fetch=async()=>orderResponse();
 await flush(()=>render(h(CustomOrders,props),host));
 await flush(()=>{});
 await flush(()=>click(button('View tracking & details')));
 assert.match(host.textContent,/Tracking history/);
 orderResponse=()=>responseFor('First request',{update});
 await flush(()=>click(button('Refresh updates')));
 await flush(()=>{});
 assert.match(host.textContent,/Tracking history/,'A fresh owned result keeps the current details open');
 assert.match(host.textContent,/In review/);
 assert.match(host.textContent,/Synthetic HQ status note/);

 orderResponse=()=>responseFor('Second request',{id:secondId});
 await flush(()=>click(button('Refresh updates')));
 await flush(()=>{});
 assert.match(host.textContent,/Second request/);
 assert.doesNotMatch(host.textContent,/Tracking history|First request|Synthetic HQ status note/);
 orderResponse=()=>responseFor('First request',{update});
 await flush(()=>click(button('Refresh updates')));
 await flush(()=>{});
 assert.ok(button('View tracking & details'),'A removed ID does not regain its old expansion');
 await flush(()=>render(h(CustomOrders,{...props,requestedSubmissionId:firstId}),host));
 await flush(()=>{});
 assert.ok(button('Hide tracking & details'),'A newly verified deep link opens its target');
 await flush(()=>click(button('Hide tracking & details')));
 await flush(()=>click(button('Refresh updates')));
 await flush(()=>{});
 assert.ok(button('View tracking & details'),'Manual refresh does not reopen the consumed link');

 await flush(()=>click(button('View tracking & details')));
 orderResponse=()=>new Response('Synthetic read failure',{status:503});
 await flush(()=>click(button('Refresh updates')));
 await flush(()=>{});
 assert.doesNotMatch(host.textContent,/Tracking history|First request|Synthetic HQ status note/);
 orderResponse=()=>responseFor('First request',{update});
 await flush(()=>click(button('Try again')));
 await flush(()=>{});
 assert.ok(button('View tracking & details'),'A failed read clears expanded details before retry');
 await flush(()=>render(null,host));
 console.log('PASS mounted Custom Orders preserves refreshed owned details, consumes a verified deep link once, and drops details on removal or failed verification.');

 // Unlike a component remount chosen by the harness, the mounted hub must
 // detect the new principal through its real account re-verification path.
 const navigation=new EventTarget();
 navigation.currentEntry={url:'https://account.example.invalid/overview'};
 globalThis.navigation=navigation;
 Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
 const principalFor=(id,name)=>Response.json({data:{customer:{
  id:`gid://shopify/Customer/${id}`,displayName:name,
 }}});
 let currentPrincipal=()=>principalFor(111,'Synthetic Alpha');
 let currentHistory=()=>responseFor('Alpha original history');
 let signedToken='synthetic-alpha-token'.repeat(3),historyReads=0;
 globalThis.shopify={sessionToken:{get:async()=>signedToken}};
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.method,'POST');
  if(url===CUSTOMER_ACCOUNT_API){
   assert.deepEqual(JSON.parse(options.body),{query:ACCOUNT_HUB_SUMMARY_QUERY});
   return currentPrincipal();
  }
  assert.equal(url,WORK_CUSTOM_ORDER_ACCOUNT_URL);
  assert.equal(options.headers.Authorization,`Bearer ${signedToken}`);
  assert.equal(options.body,'','Owner is never supplied by the UI');
  historyReads++;
  return currentHistory(options.signal);
 };
 const recheck=()=>navigation.dispatchEvent(new Event('currententrychange'));
 const visible=()=>document.dispatchEvent(new window.Event('visibilitychange'));
 const waitFor=async(pattern)=>{
  const deadline=Date.now()+2000;
  while(!pattern.test(host.textContent)&&Date.now()<deadline)await flush(()=>{});
  assert.match(host.textContent,pattern);
 };
 await flush(()=>render(h(ConnectedHub),host));
 await waitFor(/Alpha original history/);
 assert.match(host.textContent,/Synthetic Alpha/);

 let oldHistorySignal,finishOldHistory,finishBetaPrincipal;
 currentHistory=signal=>new Promise(resolve=>{
  oldHistorySignal=signal;
  finishOldHistory=resolve;
 });
 await flush(()=>click(button('Refresh activity')));
 assert.ok(finishOldHistory,'Alpha history is pending');
 signedToken='synthetic-beta-token'.repeat(3);
 currentPrincipal=()=>new Promise(resolve=>{finishBetaPrincipal=resolve;});
 currentHistory=()=>responseFor('Beta verified history');
 await flush(recheck);
 assert.ok(finishBetaPrincipal,'Navigation re-verifies the principal');
 assert.match(host.textContent,/Checking your verified Shopify account/);
 assert.doesNotMatch(host.textContent,/Synthetic Alpha|Your recent requests/);
 assert.ok(oldHistorySignal.aborted,'Principal check aborts the old screen read');
 await flush(()=>finishBetaPrincipal(principalFor(222,'Synthetic Beta')));
 await waitFor(/Beta verified history/);
 assert.match(host.textContent,/Synthetic Beta/);
 await flush(()=>finishOldHistory(responseFor('Obsolete Alpha history')));
 assert.doesNotMatch(host.textContent,/Synthetic Alpha|Obsolete Alpha history/);

 signedToken='synthetic-alpha-return-token'.repeat(3);
 currentPrincipal=()=>principalFor(111,'Synthetic Alpha');
 currentHistory=()=>responseFor('Alpha newly verified history');
 await flush(visible);
 await waitFor(/Alpha newly verified history/);
 assert.match(host.textContent,/Synthetic Alpha/);
 assert.doesNotMatch(host.textContent,/Synthetic Beta|Beta verified history|Alpha original history/);

 let finishOldPrincipal;
 currentPrincipal=()=>new Promise(resolve=>{finishOldPrincipal=resolve;});
 await flush(recheck);
 assert.ok(finishOldPrincipal,'An older principal read is pending before sign-out');
 const priorHistoryReads=historyReads;
 currentPrincipal=()=>new Response(null,{status:401});
 await flush(visible);
 await waitFor(/couldn't verify your Shopify account/);
 await flush(()=>finishOldPrincipal(principalFor(111,'Obsolete Alpha principal')));
 assert.match(host.textContent,/couldn't verify your Shopify account/);
 assert.doesNotMatch(host.textContent,/Obsolete Alpha principal|Your recent requests/);
 assert.equal(historyReads,priorHistoryReads,'No private read runs while signed out');
 console.log('PASS mounted ConnectedHub hides private screens while checking, verifies A/B/A, and fences late history and principal reads across account changes and simulated sign-out.');
}finally{
 render(null,document.querySelector('main'));
 try{unlinkSync(output);}catch{}
 delete globalThis.fetch;
 delete globalThis.shopify;
 delete globalThis.navigation;
}
