// Real inbox/row components, synthetic Router and IntersectionObserver only.
// No provider calls, auth tokens, customer data or persistence.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const app=root+'services/jill-order-desk/app-home/';
const require=createRequire(app+'package.json');
const {build}=require('esbuild'),React=require('react');
const {act}=React,{createRoot}=require('react-dom/client');
const {parseHTML}=createRequire(root+'tools/work-account-local/package.json')('linkedom');
const {document,window}=parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis,{document,window,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,
 requestAnimationFrame:fn=>fn()});
window.HTMLElement.prototype.scrollIntoView=function(){};
const observations=[];
class Observer{
 constructor(callback){this.callback=callback;observations.push(this);}
 observe(node){this.node=node;}
 disconnect(){this.disconnected=true;}
}
Object.assign(globalThis,{IntersectionObserver:Observer});
const ids=[1,2,3].map(n=>'jill:synthetic-inbox-'+n);
const records=ids.map((id,i)=>({submission_id:id,revision:1,customer_status:'received',
 internal_status:'new',submitted_at:'2026-10-18T14:53:00.000Z',updated_at:'2026-10-18T14:53:00.000Z',
 date_needed:'2026-11-03',fulfillment:'pickup',item_count:1}));
const harness={reads:[],fetchers:[],model:{state:'ready',records,readOnly:true,controlsEnabled:false,verifiedRole:'owner'}};
globalThis.__inboxHarness=harness;
const router=`import React,{useRef,useState} from 'react';
 export const Link=({to,children,...props})=>React.createElement('a',{href:to,...props},children);
 export const useRouteLoaderData=()=>globalThis.__inboxHarness.model;
 export const useRevalidator=()=>({state:'idle',revalidate(){throw Error('Unexpected mutation refresh');}});
 export function useFetcher(){const [,render]=useState(0),ref=useRef(null);
  if(!ref.current){const h=globalThis.__inboxHarness;
   const f={state:'idle',data:undefined,notify:()=>render(v=>v+1),
    load(url){f.state='loading';h.reads.push({url,f});f.notify();},
    submit(){throw Error('Inbox readback tests must never submit');}};
   ref.current=f;h.fetchers.push(f);
  }return ref.current;}`;
const file=app+'.inbox-mounted-'+randomUUID()+'.mjs';
const mount=document.querySelector('main');let mounted;
const detail=(id,name)=>({state:'ready',detail:{submission_id:id,revision:1,
 submitted_at:records[0].submitted_at,customer:{name,email:'',phone:'',preferred_contact:'email'},
 planning:{date_needed:'2026-11-03',fulfillment:'pickup',attributes:[],address:{}},
 items:[],request_attributes:[],reference_ids:[],attachment_state:'unresolved'}});
const deliver=async(f,data)=>act(async()=>{f.state='idle';f.data=data;f.notify();});
const names=()=>[...mount.querySelectorAll('.jill-inbox__cell--customer')].map(n=>n.textContent.trim());
const reads=()=>harness.reads.filter(r=>ids.some(id=>r.url==='/app/requests/'+encodeURIComponent(id)));
const visible=async(index)=>act(async()=>{
 const observer=observations.filter(o=>o.node?.classList.contains('jill-inbox__card'))[index];
 assert.ok(observer);observer.callback([{isIntersecting:true}]);
});
try{
 const built=await build({entryPoints:[app+'app/routes/app.requests.tsx'],bundle:true,write:false,
  platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-dom'],
  plugins:[{name:'synthetic-inbox-router',setup(b){
   b.onResolve({filter:/^react-router$/},()=>({path:'router',namespace:'synthetic'}));
   b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:router,loader:'js',resolveDir:app}));
   b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
  }}]});
 writeFileSync(file,built.outputFiles[0].text,{flag:'wx'});
 const {default:Inbox}=await import(pathToFileURL(file));
 await act(async()=>{mounted=createRoot(mount);mounted.render(React.createElement(Inbox));});
 assert.deepEqual(names(),['Name not loaded','Name not loaded','Name not loaded'],
  'Off-screen rows must not claim that a signed read failed');
 assert.equal(reads().length,0,'Off-screen rows do not preload private names');
 assert.deepEqual([...mount.querySelectorAll('time')].map(t=>t.textContent),Array(3).fill('Oct 18, 2026'));
 await visible(0);await visible(1);await visible(2);
 assert.equal(reads().length,2,'At most two optional detail reads start');
 assert.deepEqual(names(),['Checking name…','Checking name…','Name not loaded']);
 await deliver(reads()[0].f,detail(ids[0],'Synthetic One'));
 assert.equal(reads().length,3,'Finished read admits the next visible row');
 assert.deepEqual(names(),['Synthetic One','Checking name…','Checking name…']);
 await deliver(reads()[1].f,{state:'source_unavailable',detail:null});
 assert.equal(names()[1],'Name unavailable','A completed failed read is distinct from not loaded');
 await deliver(reads()[2].f,detail('jill:wrong-request','WRONG CUSTOMER'));
 assert.equal(names()[2],'Name unavailable');assert.ok(!mount.textContent.includes('WRONG CUSTOMER'));
 const before=reads().length;
 const second=mount.querySelectorAll('.jill-inbox__row-trigger')[1];
 await act(async()=>second.dispatchEvent(new window.Event('click',{bubbles:true})));
 assert.equal(reads().length,before+1,'Explicit expansion retries a failed exact-ID read once');
 assert.equal(reads().at(-1).url,'/app/requests/'+encodeURIComponent(ids[1]));
 await deliver(reads().at(-1).f,detail(ids[1],'Synthetic Recovered'));
 assert.equal(names()[1],'Synthetic Recovered');
 assert.equal(reads().length,before+1,'Successful recovery never starts an automatic retry');
 await act(async()=>mounted.unmount());mounted=null;
 // Every pending signed read finishes before a fresh inbox mount. No name
 // persists in a module cache or carries over to another authenticated mount.
 await act(async()=>{mounted=createRoot(mount);mounted.render(React.createElement(Inbox));});
 assert.deepEqual(names(),Array(3).fill('Name not loaded'));
 assert.ok(!mount.textContent.includes('Synthetic One'));
 console.log('PASS mounted inbox: truthful off-screen/queued/loading/failure names, two-read bound, exact-ID isolation, explicit retry, remount privacy and full ISO submitted dates.');
}finally{
 if(mounted)await act(async()=>mounted.unmount());
 unlinkSync(file);delete globalThis.__inboxHarness;
}
