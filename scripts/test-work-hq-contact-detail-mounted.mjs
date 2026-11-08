// Mount the real HQ Contact detail across ticket changes. Synthetic Router and
// ticket responses only: no Shopify sessions, database, or provider calls.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {unlinkSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const app=root+'services/jill-order-desk/app-home/';
const require=createRequire(app+'package.json');
const {build}=require('esbuild'),React=require('react');
const {act}=React,{createRoot}=require('react-dom/client');
const {Simulate}=require('react-dom/test-utils');
const {parseHTML}=createRequire(root+'tools/work-account-local/package.json')('linkedom');
const {document,window}=parseHTML('<html><body><div id="root"></div></body></html>');
Object.assign(globalThis,{document,window,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});

const a='jill:contact:11111111-2222-4333-8444-555555555555';
const b='jill:contact:22222222-2222-4333-8444-555555555555';
const detail=ticket_id=>({ok:true,code:'ready',can_change_status:true,can_post_message:true,
 detail:{ticket_id,revision:1,status:'received',reason:'Synthetic question',
  name:'Synthetic name',email:'example@example.invalid',phone:'',
  preferred_contact:'email',message:'Synthetic intake',details:{}}});
const harness={model:detail(a),submissions:[]};
globalThis.__contactHarness=harness;
const router=`import React,{useRef,useState} from 'react';
 export const Link=({to,children})=>React.createElement('a',{href:to},children);
 export const useLoaderData=()=>globalThis.__contactHarness.model;
 const revalidator={state:'idle',revalidate(){throw Error('Unexpected success readback');}};
 export const useRevalidator=()=>revalidator;
 export function useFetcher(){const [,render]=useState(0),ref=useRef(null);
  if(!ref.current){const h=globalThis.__contactHarness;
   const f={state:'idle',data:undefined,
    submit(body,options){h.submissions.push({body,options,fetcher:f});},
    settle(data){f.data=data;render(v=>v+1);}};
   ref.current=f;
  }return ref.current;}`;

const mount=document.querySelector('#root');
const file=app+'.contact-detail-mounted-'+randomUUID()+'.mjs';
const control=label=>[...mount.querySelectorAll('button')].find(x=>x.textContent===label);
const click=async label=>act(async()=>{
 const button=control(label);
 assert.ok(button&&!button.disabled,label+' is available');
 Simulate.click(button);
});
const editMessage=async text=>act(async()=>{
 const draft=mount.querySelector('textarea');
 draft.value=text;
 Simulate.change(draft);
});
let mounted;
try{
 const built=await build({entryPoints:[app+'app/routes/app.contacts.$ticketId.tsx'],
  bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',
  external:['react','react/jsx-runtime'],plugins:[{name:'synthetic-contact-router',setup(bundler){
   bundler.onResolve({filter:/^react-router$/},()=>({path:'router',namespace:'synthetic'}));
   bundler.onResolve({filter:/^\.\.\/shopify\.server$/},()=>({path:'shopify',namespace:'synthetic'}));
   bundler.onLoad({filter:/^router$/,namespace:'synthetic'},()=>({contents:router,resolveDir:app}));
   bundler.onLoad({filter:/^shopify$/,namespace:'synthetic'},()=>({
    contents:'export function workShopify(){throw Error("Provider calls are out of scope");}',
   }));
  }}]});
 writeFileSync(file,built.outputFiles[0].text,{flag:'wx'});
 const {default:ContactDetail}=await import(pathToFileURL(file));
 mounted=createRoot(mount);
 const show=async model=>act(async()=>{
  harness.model=model;
  mounted.render(React.createElement(ContactDetail));
 });
 await show(detail(a));
 await click('Under review');
 const previousStatus=harness.submissions.at(-1);
 assert.equal(previousStatus.body.ticket_id,a);
 await act(async()=>previousStatus.fetcher.settle({ok:false,code:'source_unavailable'}));
 await show(detail(a));
 await click('Under review');
 assert.deepEqual(harness.submissions.at(-1).body,previousStatus.body,
  'A same-ticket refresh preserves the exact uncertain status operation');

 await editMessage('Draft for the first ticket');
 await click('Save message to My JILL thread');
 const previousMessage=harness.submissions.at(-1);
 assert.equal(previousMessage.body.ticket_id,a);
 assert.equal(previousMessage.body.message,'Draft for the first ticket');
 await act(async()=>previousMessage.fetcher.settle({ok:false,code:'source_unavailable'}));
 assert.match(mount.textContent,/The update is unconfirmed.*Message save unconfirmed/s);
 await show(detail(a));
 await click('Save message to My JILL thread');
 assert.deepEqual(harness.submissions.at(-1).body,previousMessage.body,
  'A same-ticket refresh preserves the exact uncertain message operation');

 await show(detail(b));
 assert.match(mount.textContent,new RegExp(b));
 await click('Under review');
 const nextStatus=harness.submissions.at(-1);
 assert.equal(nextStatus.body.ticket_id,b,'Status click on B must never replay ticket A');
 assert.notEqual(nextStatus.body.operation_id,previousStatus.body.operation_id);
 assert.equal(mount.querySelector('textarea').value,'','A draft cannot follow its editor to ticket B');
 assert.doesNotMatch(mount.textContent,/The update is unconfirmed|Message save unconfirmed/);
 await editMessage('Draft for the second ticket');
 await act(async()=>previousMessage.fetcher.settle({ok:true,ticket_id:a,
  operation_id:previousMessage.body.operation_id,sequence:1,code:'already_persisted'}));
 assert.equal(mount.querySelector('textarea').value,'Draft for the second ticket');
 assert.doesNotMatch(mount.textContent,/Message save acknowledged|Message #1 confirmed/);
 console.log('PASS mounted HQ Contact detail keeps status retries on the same ticket and clears draft/receipt state when the verified ticket changes.');
}finally{
 if(mounted)await act(async()=>mounted.unmount());
 try{unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}
 delete globalThis.__contactHarness;
}
