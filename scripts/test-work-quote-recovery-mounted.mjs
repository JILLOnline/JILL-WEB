// Actual React worksheet, synthetic Router fetchers and local DOM only.
// No Shopify session, remote D1 or provider calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createQuoteRecoveryBrowser} from './fixtures/work-quote-recovery-browser.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const app=root+'services/jill-order-desk/app-home/';
const require=createRequire(app+'package.json');
const {build}=require('esbuild');
const React=require('react');
const {act}=React;
const {createRoot}=require('react-dom/client');
const domRequire=createRequire(root+'tools/work-account-local/package.json');
const {parseHTML}=domRequire('linkedom');
const {document,window}=parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis,{document,window,HTMLElement:window.HTMLElement,
 IS_REACT_ACT_ENVIRONMENT:true});
const browser=createQuoteRecoveryBrowser();
Object.defineProperty(globalThis,'localStorage',{value:browser.storage,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{locks:browser.locks},configurable:true});
const harness={fetchers:[],reads:[],saves:[]};
globalThis.__quoteHarness=harness;
const router=`import {useRef,useState} from 'react';
 export function useFetcher(){
  const [,render]=useState(0);const ref=useRef(null);
  if(!ref.current){const h=globalThis.__quoteHarness;
   const f={state:'idle',data:undefined,notify:()=>render(v=>v+1),
    load(url){f.state='loading';h.reads.push({url,f});f.notify();},
    submit(payload){f.state='submitting';h.saves.push({payload,f});f.notify();}};
   ref.current=f;h.fetchers.push(f);
  }return ref.current;
 }`;
const file=app+'.quote-mounted-'+randomUUID()+'.mjs';
let mounted;
const mount=document.querySelector('main');
const id='jill:synthetic-mounted-1234',item='item:synthetic-mounted-1';
const fees={materials:'0.00',labor:'0.00',shipping:'0.00',other:'0.00',discount:'0.00',tax:'0.00'};
const draft=revision=>({state:'ready',submission_id:id,source_revision:3,
 draft_revision:revision,estimated_total_cents:1000,
 lines:[{id:item,quantity:1,unitPrice:'10.00'}],fees});
const scope='a'.repeat(64);
const read=(revision=4,recovery,ownerScope=scope)=>({ok:true,code:'draft_ready',submission_id:id,draft:draft(revision),recovery_scope:ownerScope,...(recovery?{recovery}:{})});
const button=label=>[...mount.querySelectorAll('button')].find(x=>x.textContent===label);
const click=label=>button(label).dispatchEvent(new window.Event('click',{bubbles:true}));
const deliver=async(f,data)=>{await act(async()=>{f.state='idle';f.data=data;f.notify();});};
const flush=async()=>{await act(async()=>{await new Promise(r=>setTimeout(r,0));});};
try{
 const result=await build({entryPoints:[app+'app/components/WorkQuoteWorksheet.tsx'],
  bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',
  external:['react','react/jsx-runtime'],plugins:[{name:'synthetic-router',setup(b){
   b.onResolve({filter:/^react-router$/},()=>({path:'router',namespace:'synthetic'}));
   b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:router,loader:'js',resolveDir:app}));
   b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
  }}]});
 writeFileSync(file,result.outputFiles[0].text,{flag:'wx'});
 const {WorkQuoteWorksheet}=await import(pathToFileURL(file));
 const model={state:'ready',detail:{submission_id:id,revision:3,items:[{item_id:item,title:'Synthetic item',quantity:1}]}};
 const render=async(enabled=true,preflightEnabled=false)=>{await act(async()=>{
  mounted=createRoot(mount);
  mounted.render(React.createElement(WorkQuoteWorksheet,{model,submissionId:id,
   customerStatus:'reviewing',sourceRevision:3,savedDraft:draft(4),saveDraftEnabled:enabled,
   quotePreflightEnabled:preflightEnabled}));
 });};
 await render(false);
 assert.equal(harness.reads.length,0);assert.equal(harness.saves.length,0);
 assert.equal(button('Save Draft').disabled,true);
 await act(async()=>mounted.unmount());
 await render();
 await deliver(harness.reads.at(-1).f,read());
 assert.equal(button('Save Draft').disabled,false);
 await act(async()=>{for(let i=0;i<50;i++)click('Save Draft');});
 await flush();
 assert.equal(harness.saves.length,1,'50 rapid clicks issue one actual submit');
 const original=harness.saves[0];
 const op=original.payload.operation_id;
 await deliver(original.f,{ok:false,code:'commit_unconfirmed'});
 await act(async()=>click('Reload saved draft'));
 assert.ok(harness.reads.at(-1).url.includes(encodeURIComponent(op)));
 const pending={operation_id:op,expected_draft_revision:4,state:'unresolved'};
 await deliver(harness.reads.at(-1).f,read(4,pending));
 assert.equal(button('Save Draft').disabled,true,'Older authenticated read does not unlock');
 assert.ok([...browser.data.values()].some(v=>v.includes(op)));
 // Destroy the real component while original server work could still commit.
 await act(async()=>mounted.unmount());
 await render();
 await deliver(harness.reads.at(-1).f,read());
 assert.ok(harness.reads.at(-1).url.includes(encodeURIComponent(op)),
  'New mount automatically reconciles original durable operation');
 await deliver(harness.reads.at(-1).f,read(4,pending));
 assert.equal(button('Save Draft').disabled,true);
 assert.equal(harness.saves.length,1,'Remount and retry never create another write');
 await act(async()=>click('Reload saved draft'));
 await deliver(harness.reads.at(-1).f,read(5,{...pending,state:'committed'}));
 await flush();
 assert.equal(button('Save Draft').disabled,false,'Late commit exact receipt permits next edit');
 assert.equal(browser.data.size,0);
 // A stale retained response cannot consume/clear a subsequent operation.
 await act(async()=>click('Save Draft'));await flush();
 assert.equal(harness.saves.length,2);
 const second=harness.saves.at(-1);
 assert.notEqual(second.payload.operation_id,op);
 assert.equal(second.payload.expected_draft_revision,5);
 await deliver(second.f,{ok:true,code:'draft_saved',operation_id:second.payload.operation_id,revision:6});
 assert.equal(button('Save Draft').disabled,true,'ACK alone retains operation');
 await act(async()=>click('Reload saved draft'));
 await deliver(harness.reads.at(-1).f,read(5,{...pending,state:'committed'}));
 assert.equal(button('Save Draft').disabled,true,'Wrong operation receipt fails closed');
 assert.ok([...browser.data.values()].some(v=>v.includes(second.payload.operation_id)));
 // A different Owner's read cannot settle the previous Owner's marker.
 await act(async()=>mounted.unmount());
 await render();
 await deliver(harness.reads.at(-1).f,read(5,undefined,'b'.repeat(64)));
 assert.ok([...browser.data.values()].some(v=>v.includes(second.payload.operation_id)));
 assert.equal(harness.saves.length,2);
 // A queued cross-tab lock cannot dispatch after the real component unmounts.
 let unlock;
 const gate=new Promise(resolve=>{unlock=resolve;});
 const lock=browser.locks.request;
 browser.locks.request=(key,callback)=>lock(key,async()=>{await gate;return callback();});
 await act(async()=>click('Save Draft'));
 await act(async()=>mounted.unmount());mounted=null;
 unlock();await flush();
 assert.equal(harness.saves.length,2,'No POST after an asynchronous lock outlives the component');
 browser.data.clear();
 await render(true,true);
 await deliver(harness.reads.at(-1).f,read());
 await act(async()=>click('Verify saved quote'));
 const oldReview=harness.reads.at(-1);
 const reviewParams=({url})=>new URL(url,'https://synthetic.invalid').searchParams;
 assert.equal(reviewParams(oldReview).get('expected_source_revision'),'3');
 assert.equal(reviewParams(oldReview).get('expected_draft_revision'),'4');
 const ready=draft_revision=>({state:'ready_for_native_shopify_calculation',
  source_revision:3,draft_revision,verified_line_count:1,
  can_publish:false,can_invoice:false,can_create_order:false,
  can_charge_customer:false,can_send_email:false});
 await deliver(oldReview.f,ready(4));
 assert.match(mount.textContent,/Source and catalog checks passed/);
 await act(async()=>click('Reload saved draft'));
 await deliver(harness.reads.at(-1).f,read(5));
 assert.doesNotMatch(mount.textContent,/Source and catalog checks passed/,
  'A verified reload of revision 5 must not carry forward readiness for revision 4');
 await act(async()=>click('Verify saved quote'));
 const currentReview=harness.reads.at(-1);
 assert.equal(reviewParams(currentReview).get('expected_draft_revision'),'5');
 await deliver(currentReview.f,ready(4));
 assert.doesNotMatch(mount.textContent,/Source and catalog checks passed/,
  'A mismatched readiness response must stay on HOLD');
 await act(async()=>click('Verify saved quote'));
 await deliver(harness.reads.at(-1).f,ready(5));
 assert.match(mount.textContent,/Source and catalog checks passed/);
 console.log('PASS mounted React quote: OFF zero I/O; 50 clicks; uncertain save → older read → remount → late commit; exact operation ACK/readback; Owner isolation; no automatic write retry; readiness scoped to the restored revision.');
}finally{
 if(mounted)await act(async()=>mounted.unmount());
 unlinkSync(file);
 delete globalThis.__quoteHarness;
}
