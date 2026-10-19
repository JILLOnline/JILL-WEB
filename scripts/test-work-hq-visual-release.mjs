import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertVisualModule} from './check-work-hq-visual-only.mjs';
import {visualBaseline,inspectVisualCandidate,ownedVisualAllocation,VISUAL_BASE,VISUAL_DEPLOYMENT} from './release-work-hq-visual-theme-owner.mjs';
import {HQ_ACTIVE,HQ_QUOTE,HQ_MARKER} from './stage-work-hq-connected-read-owner.mjs';
import {CONNECTED_SOURCE} from './release-work-hq-connected-read-owner.mjs';
const module=`import "./inbox.css"; export async function loader(){return {allowed:false}};
 export default function Page(){const [n,setN]=useState(0);return <s-page heading="WORK"><button onClick={()=>setN(n+1)}>Save</button></s-page>}`;
assertVisualModule(module,module.replace('<s-page heading','<s-page inlineSize="large" heading'));
for(const name of ['app','app.index','app.requests','app.requests.$submissionId','app.catalog','app.access','app.setup-owner']){
  const source=fs.readFileSync(new URL('../services/jill-order-desk/app-home/app/routes/'+name+'.tsx',import.meta.url),'utf8').replace(/\r\n?/g,'\n');
  const windows=source.replace(/\n/g,'\r\n');
  assertVisualModule(source,windows);assertVisualModule(windows,source);
}
for(const mutate of [s=>s.replace('allowed:false','allowed:true'),s=>s.replace('useState(0)','useState(9)'),
  s=>s.replace('setN(n+1)','setN(n+2)'),s=>s.replace('>Save<','>Invoice<'),
  s=>s.replace('<button onClick={()=>setN(n+1)}>Save</button>','')]){
  assert.throws(()=>assertVisualModule(module,mutate(module)));
  assert.throws(()=>assertVisualModule(module,mutate(module).replace(/\n/g,'\r\n')));
}
const baseline={deployment:VISUAL_DEPLOYMENT,versions:[{id:VISUAL_BASE,percentage:100},{id:HQ_QUOTE,percentage:0}]};
visualBaseline(baseline);assert.throws(()=>visualBaseline({...baseline,deployment:HQ_ACTIVE}));
assert.throws(()=>visualBaseline({...baseline,versions:[{id:VISUAL_BASE,percentage:99},{id:HQ_QUOTE,percentage:1}]}));
const bindings=[...Object.entries({JILL_WORK_HOST_STAGE:'canary',JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',JILL_WORK_MERCHANT_WRITES_ENABLED:'true',JILL_WORK_HQ_DETAIL_ENABLED:'true'})
  .map(([name,text])=>({name,text,type:'plain_text'})),
  ...['JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET','JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET']
    .map(name=>({name,type:'secret_text'})),{name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:'3f17c186-c794-4e00-8f20-017191373a19'}];
const original={id:HQ_ACTIVE,resources:{bindings,script:{etag:'original',handlers:['fetch']},
  script_runtime:{compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],assets:{revision_id:'original'}}}};
const base={id:VISUAL_BASE,annotations:{'workers/message':HQ_MARKER+CONNECTED_SOURCE},resources:{
  ...original.resources,script:{etag:'current',handlers:['fetch']},bindings:[...bindings,
    ...Object.entries({JILL_WORK_CATALOG_ENABLED:'true',JILL_WORK_CONVERSATION_ENABLED:'false',JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false'})
      .map(([name,text])=>({name,text,type:'plain_text'})),{name:'CF_VERSION_METADATA',type:'version_metadata'}]}};
const source='a'.repeat(40),id='11111111-2222-4333-8444-555555555555';
const candidate={...structuredClone(base),id,annotations:{'workers/message':HQ_MARKER+source}};
candidate.resources.script.etag='new-visual-source';candidate.resources.script_runtime.assets.revision_id='new-visual-assets';
assert.equal(inspectVisualCandidate({original,base,candidate,source}).current_flags_and_bindings_preserved,true);
for(const mutate of [
  x=>x.resources.bindings.find(b=>b.name==='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED').text='true',
  x=>x.resources.bindings.find(b=>b.name==='JILL_WORK_CATALOG_ENABLED').text='false',
  x=>x.resources.bindings.push({name:'MEDIA',type:'r2_bucket'}),
  x=>x.resources.script.etag='current',x=>x.resources.script_runtime.compatibility_date='2026-10-19',
  x=>x.resources.bindings.find(b=>b.type==='d1').id=id,
]){const bad=structuredClone(candidate);mutate(bad);assert.throws(()=>inspectVisualCandidate({original,base,candidate:bad,source}));}
// A new edition must compare against its own exact active source and code.
const studioBase=structuredClone(base);studioBase.id='80b47610-4d8a-4186-a4c8-fe4f05daf964';
studioBase.annotations['workers/message']=HQ_MARKER+'9a92d0287e69628c63bd7bec9a5e3dace63f1c94';
studioBase.resources.script.etag='studio-baseline';
assert.equal(inspectVisualCandidate({original,base:studioBase,candidate,source,
  baseId:studioBase.id,baseSource:'9a92d0287e69628c63bd7bec9a5e3dace63f1c94'}).current_flags_and_bindings_preserved,true);
assert.throws(()=>inspectVisualCandidate({original,base:studioBase,candidate,source}));
const attempt={candidate:id,nonce:'22222222-3333-4444-8555-666666666666'};
const active={deployment:'33333333-4444-4555-8666-777777777777',message:'JILL HQ WORK visual theme v1 activate '+attempt.nonce,
  versions:[{id,percentage:100},{id:HQ_QUOTE,percentage:0}]};
ownedVisualAllocation(active,attempt);
for(const change of [{message:'newer operator deployment'},{deployment:VISUAL_DEPLOYMENT},
  {versions:[{id,percentage:100}]},{versions:[{id,percentage:90},{id:HQ_QUOTE,percentage:10}]}])
  assert.throws(()=>ownedVisualAllocation({...active,...change},attempt));
ownedVisualAllocation({...active,message:'JILL HQ WORK visual theme v1 restore '+attempt.nonce,
  versions:baseline.versions},attempt,{restored:true});
console.log('PASS visual-only boundary and WORK release policy: handlers/hooks/control behavior/copy unchanged, current flags/bindings preserved, exact baseline and owned traffic switch/restore only.');
