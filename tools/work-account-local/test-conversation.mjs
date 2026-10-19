// Actual Preact components + local DOM + real shared fetch adapter. No
// Shopify validation upload, browser account, real JWT or remote request.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseHTML} from 'linkedom';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(path.join(ROOT,'services/custom-order-cloudflare/package.json'));
const workerRequire=createRequire(require.resolve('wrangler'));
const {build}=workerRequire('esbuild');
const accountRequire=createRequire(import.meta.url);
const preactPackage=path.dirname(accountRequire.resolve('preact/package.json'));
const {document,window}=parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis,{document,window,HTMLElement:window.HTMLElement,
  requestAnimationFrame:fn=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout});
class Field extends window.HTMLElement{
  get value(){return this.getAttribute('value')||'';}
  set value(v){this.setAttribute('value',v);}
  get disabled(){return this.hasAttribute('disabled');}
  set disabled(v){if(v)this.setAttribute('disabled','');else this.removeAttribute('disabled');}
}
window.customElements.define('s-text-area',Field);
const mount=document.querySelector('main');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-account-conversation-'));
let render;
const readUrl='https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev/jill-custom-order-account';
const replyUrl=new URL('/jill-custom-order-reply',readUrl).href;
let current='A',revision=1,readFailure=false,behavior='stale',releaseSend;
const commands=[];let tokens=0,reads=0;
globalThis.shopify={sessionToken:{get:async()=>{tokens++;return 'synthetic-session-token-'+current.repeat(40);}}};
const response=value=>new Response(JSON.stringify(value));
const error=code=>new Response(JSON.stringify({version:1,operation:'custom_order.account.reply.result',ok:false,error:{code}}),{status:409});
const order=()=>({submission_id:'jill:synthetic-account-'+current,timeline_version:2,
  revision,status:'reviewing',updated_at:'2026-10-19T00:00:00Z',
  summary:{items:[{title:'Synthetic request',quantity:1}],date_needed:'',fulfillment:''},
  timeline:[{revision:1,status:'received',author:'system',kind:'status',note:'Received',occurred_at:'2026-10-18T23:00:00Z'}]});
globalThis.fetch=async(url,options)=>{
  assert.equal(options.method,'POST');assert(options.headers.Authorization.endsWith(current.repeat(40)));
  if(url===readUrl){reads++;if(readFailure)throw Error('synthetic history outage');
    return response({version:1,operation:'custom_order.account.list.result',ok:true,orders:[order()]});}
  assert.equal(url,replyUrl,'Only synthetic transport is allowed');
  const command=JSON.parse(options.body);commands.push(command);
  if(command.mode==='receipt'){
    revision=command.expected_revision+1;
    return response({version:1,operation:'custom_order.account.reply.result',ok:true,
      submission_id:command.submission_id,operation_id:command.operation_id,revision});
  }
  if(behavior==='stale')return error('stale_revision');
  if(behavior==='deferred')return new Promise((resolve,reject)=>{releaseSend=()=>reject(Error('synthetic lost acknowledgement'));});
  throw Error('Unexpected send');
};
const waitFor=async(test,label)=>{
  const deadline=Date.now()+5000;
  while(!test()){if(Date.now()>deadline)throw Error('Timed out: '+label);await new Promise(r=>setTimeout(r,10));}
};
const button=text=>[...mount.querySelectorAll('s-button')].find(el=>el.textContent===text);
const field=()=>mount.querySelector('s-text-area');
const click=text=>{assert(button(text),'Missing button '+text);button(text).dispatchEvent(new window.Event('click',{bubbles:true}));};
const type=text=>{field().value=text;field().dispatchEvent(new window.Event('input',{bubbles:true}));};
try{
  const bundle=path.join(temp,'account.mjs');
  await build({stdin:{contents:`export {render,h} from 'preact';
    export {default as CustomOrders} from './extensions/jill-account-dashboard/src/pages/CustomOrders.jsx';`,
    resolveDir:ROOT,sourcefile:'local-account-test.jsx'},outfile:bundle,bundle:true,
    format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',alias:{preact:preactPackage}});
  const app=await import(pathToFileURL(bundle));render=app.render;
  render(app.h(app.CustomOrders,{}),mount);
  await waitFor(()=>field(),'initial verified history');
  type('Keep this message through stale history');await waitFor(()=>!button('Send message').hasAttribute('disabled'),'typed');
  click('Send message');click('Send message');
  await waitFor(()=>mount.textContent.includes('New updates are available'),'stale acknowledgement');
  assert.equal(commands.length,1,'Double click must not create a second operation');
  assert.equal(field().value,'Keep this message through stale history');
  revision=2;click('Refresh conversation');
  await waitFor(()=>field()&&!button('Send message')?.hasAttribute('disabled'),'new revision after remount');
  assert.equal(field().value,'Keep this message through stale history');
  behavior='deferred';click('Send message');
  await waitFor(()=>releaseSend,'in-flight send');
  click('Refresh updates');
  await waitFor(()=>field()&&button('Check delivery'),'remount during send');
  click('Check delivery');assert.equal(commands.length,2,'In-flight operation must stay locked across remount');
  releaseSend();
  await waitFor(()=>mount.textContent.includes('Delivery is not confirmed'),'lost acknowledgement');
  const uncertain=commands[1];assert.equal(uncertain.expected_revision,2);
  click('Refresh conversation');
  await waitFor(()=>field()&&button('Check delivery'),'unconfirmed receipt after refresh');
  assert.equal(commands.length,2,'Refresh never resends a command');
  assert.equal(field().value,uncertain.text);
  click('Check delivery');
  await waitFor(()=>mount.textContent.includes('Message received by JILL.'),'receipt recovered');
  await waitFor(()=>field()&&field().value==='','confirmed draft cleared');
  assert.deepEqual(commands[2],{...uncertain,mode:'receipt'},'Receipt must retain the exact original operation');
  type('A private unsent draft');click('Refresh updates');
  await waitFor(()=>field()&&field().value==='A private unsent draft','unsent draft preserved');
  readFailure=true;click('Refresh updates');
  await waitFor(()=>mount.textContent.includes("couldn't verify"),'history outage');assert.equal(field(),null);
  readFailure=false;click('Try again');
  await waitFor(()=>field()&&field().value==='A private unsent draft','draft after read recovery');
  current='B';revision=1;click('Refresh updates');
  await waitFor(()=>mount.textContent.includes('jill:synthetic-account-B'),'verified account B');
  assert.equal(field().value,'','A draft must not appear in B');
  current='A';click('Refresh updates');
  await waitFor(()=>mount.textContent.includes('jill:synthetic-account-A'),'verified account A again');
  assert.equal(field().value,'','Pruned account A draft must not resurrect');
  releaseSend=null;type('A pending private message');
  await waitFor(()=>!button('Send message').hasAttribute('disabled'),'late draft render');
  click('Send message');
  await waitFor(()=>releaseSend,'late acknowledgement fixture');
  current='B';click('Refresh updates');
  await waitFor(()=>mount.textContent.includes('jill:synthetic-account-B'),'B during A send');
  releaseSend();await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(field().value,'','Late A result must not recreate a pruned draft in B');
  assert(!mount.textContent.includes('Delivery is not confirmed'),'Late A error must not enter B UI');
  assert.equal(tokens,reads+commands.length,'Every read/send/receipt obtains a fresh token');
  console.log('PASS actual Preact stale refresh, in-flight remount, exact uncertain receipt, read outage and account-switch draft privacy.');
}finally{if(render)render(null,mount);fs.rmSync(temp,{recursive:true,force:true});}
