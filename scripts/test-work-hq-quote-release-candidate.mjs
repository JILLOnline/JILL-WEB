// JILL WORK quote Save/Reload candidate: fail-closed release policy.
// OFFLINE, no Shopify/Cloudflare/Google network traffic, NO deployment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  workQuoteDraftFeatureReady as ready,
  workQuoteDraftSchemaReady as schema,
  WORK_QUOTE_DRAFT_RELEASE_STATUS as status,
} from '../services/jill-order-desk/work-quote-release-readiness.mjs';

let cases=0;
const expect=(value,answer,msg)=>{
  assert.equal(value,answer,msg);cases++;
};
const work={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_HQ_DETAIL_ENABLED:'true',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
  JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'true',
  JILL_HQ_MERCHANT_READ_SECRET:'SYNTHETIC_WORK_OWNER_READ_SECRET_ONLY_123',
  JILL_HQ_MERCHANT_WRITE_SECRET:'SYNTHETIC_WORK_OWNER_WRITE_SECRET_ONLY_123',
  SHOPIFY_API_SECRET:'SYNTHETIC_SHOPIFY_API_SECRET_ONLY_123',
  JILL_WORK_SESSION_KEY_B64:'SYNTHETIC_SESSION_32BYTE_SECRET_ONLY_123',
  JILL_ORDER_DESK_WORK_DB:{prepare(){return {all(){return {results:[]}}}}},
};
expect(ready(work),true,'all explicit conditions for a future approved release');
expect(ready({}),false,'missing environment');
expect(ready(null),false,'null environment');
const wrong=[
  ['JILL_WORK_HOST_STAGE','live'],
  ['JILL_WORK_HOST_STAGE','work'],
  ['JILL_WORK_OWNER_BOOTSTRAP_ENABLED','true'],
  ['JILL_WORK_OAUTH_ENABLED','false'],
  ['JILL_WORK_HQ_DETAIL_ENABLED','false'],
  ['JILL_WORK_MERCHANT_WRITES_ENABLED','false'],
  ['JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED',false],
  ['JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','false'],
  ['JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','TRUE'],
  ['JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED',undefined],
  ['JILL_HQ_MERCHANT_READ_SECRET','short'],
  ['JILL_HQ_MERCHANT_WRITE_SECRET','short'],
  ['SHOPIFY_API_SECRET','short'],
  ['JILL_WORK_SESSION_KEY_B64','short'],
  ['JILL_ORDER_DESK_WORK_DB',null],
  ['JILL_ORDER_DESK_WORK_DB',{prepare:null}],
  ['JILL_HQ_MERCHANT_READ_SECRET',work.SHOPIFY_API_SECRET],
  ['JILL_HQ_MERCHANT_READ_SECRET',work.JILL_WORK_SESSION_KEY_B64],
  ['JILL_HQ_MERCHANT_READ_SECRET',work.JILL_HQ_MERCHANT_WRITE_SECRET],
  ['JILL_HQ_MERCHANT_WRITE_SECRET',work.JILL_WORK_SESSION_KEY_B64],
];
for(const [k,v] of wrong)expect(ready({...work,[k]:v}),false,k);
for(const k of Object.keys(work)){
  const copy={...work};delete copy[k];
  expect(ready(copy),false,'missing '+k);
}
const tableNames=[
  {name:'jill_work_quote_draft_operations'},
  {name:'jill_work_quote_drafts'},
];
const db=value=>({prepare(sql){
  assert.ok(sql.includes('sqlite_master')&&sql.includes("type='table'"),
    'Only D1 schema metadata can be inspected');
  return {all:async()=>value};
}});
const goodDb=db({results:tableNames});
expect(await schema(goodDb),true,'both exact tables');
for(const broken of [
  null,undefined,{},[],{results:[]},
  {results:tableNames.slice(0,1)},
  {results:[tableNames[1],tableNames[0]]},
  {results:[tableNames[0],tableNames[0]]},
  {results:[...tableNames,{name:'jill_shopify_sessions'}]},
  {results:tableNames.map(x=>({...x,type:'table'}))},
]){
  expect(await schema(db(broken)),false,'missing, forged or unverified quote D1');
}
expect(await schema({prepare(){throw Error('synthetic D1 error')}}),false,
  'D1 errors never grant quote access');
expect(await schema(undefined),false,'missing D1');

const rel=status;
for(const [k,v] of Object.entries({
  source_only_candidate:true,
  release_authorized:false,
  paid_resources_authorized:false,
  customer_quote_delivery_authorized:false,
  shopify_invoice_authorized:false,
  live_keep_authorized:false,
})){expect(rel[k],v,'explicit capability boundary: '+k);}
const root='services/jill-order-desk/app-home/';
const worker=readFileSync(root+'workers/app.ts','utf8');
const endpoint=readFileSync(root+'app/routes/app.requests.quote-draft.tsx','utf8');
const page=readFileSync(root+'app/routes/app.requests.$submissionId.tsx','utf8');
const detail=readFileSync(root+'app/routes/app.requests-detail-source.server.ts','utf8');
const ui=readFileSync(root+'app/components/WorkQuoteWorksheet.tsx','utf8');
const manifest=JSON.parse(readFileSync(root+'wrangler.canary.jsonc','utf8'));
const manifestWork=JSON.parse(readFileSync(root+'wrangler.jsonc','utf8'));
for(const m of [manifest,manifestWork]){
  expect(m.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED,undefined,
    'release switch absent from all manifest sources');
  expect(m.r2_buckets,undefined,'no R2 provisioning');
}
for(const marker of [
  'if(!workQuoteDraftFeatureReady(env))',
  'if(!await workQuoteDraftSchemaReady(env.JILL_ORDER_DESK_WORK_DB))',
  'return unavailable("quote_drafts_not_enabled")',
  'return unavailable("quote_storage_unavailable")',
]){
  expect(worker.includes(marker),true,'Worker release gate '+marker);
}
expect(endpoint.includes('request,enabled:workQuoteDraftFeatureReady(env)'),
  true,'both action and loader independently enforce release gate');
expect(endpoint.split('request,enabled:workQuoteDraftFeatureReady(env)').length,
  3,'GET and POST separately verify release gate');
expect(detail.includes('workQuoteDraftFeatureReady(env)'),true,
  'signed Google detail Owner gate for UI');
expect(detail.indexOf('grant.allowed!==true')<
  detail.indexOf('workQuoteDraftFeatureReady(env)'),true,
  'Owner D1 gate runs before quote UI readiness');
expect(page.includes('saveDraftEnabled={original?.quoteDraftEnabled===true &&'),
  true,'UI enabled only from authenticated verified loader flag');
expect(page.includes('controlsEnabled}'),true,'management controls must be on');
for(const marker of [
  'const initialReadStarted=useRef(false)',
  'if(!saveDraftEnabled||!verifiedSource||initialReadStarted.current)',
  'readFetcher.load(workQuoteDraftReadPath(submissionId))',
  'if(merchantEdited.current&&!merchantExplicitReload.current)',
  'merchantExplicitReload.current=true',
  'setPrices(projection.prices)',
  'setDraftRevision(projection.draftRevision)',
  'setBlocked(true)',
]){
  expect(ui.includes(marker),true,'UI restore safety '+marker);
}
expect(ui.includes('if(!canUseDraft||!readyQuote)return;'),true,
  'saving must require complete prices and fresh source');
expect(!/localStorage|sessionStorage|indexedDB|navigator\.sendBeacon/.test(ui),
  true,'no persistence or beacon in browser');
console.log('PASS WORK Quote Save+Reload release candidate OFFLINE: '+cases+
  ' WORK-only flags, secret/Owner readiness, exact D1 schema, auto-restore/edit protection, manifest-OFF and UI gates.');
console.log('HOLD: this candidate did not upload/deploy a Worker, enable a flag, touch customer records, Shopify, Google, R2, LIVE/KEEP or incur paid capacity.');
