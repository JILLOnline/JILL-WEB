// Real LOCAL D1, synthetic Shopify Owner and canonical WORK QA data.
// Tests the future quote draft read and browser restore contract with
// corrupt/mismatched data. No provider traffic or real customer records.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestHarness} from 'wrangler';
import {handleWorkQuoteDraftRead,projectVerifiedWorkQuoteDraft}
  from '../../work-quote-draft-read.mjs';
import {hydrateVerifiedWorkQuoteWorksheet}
  from '../../work-quote-restore-model.mjs';
import {planLocalWorkQuoteDraftSave} from '../../work-quote-draft-plan.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const SVC=resolve(ROOT,'services/jill-order-desk');
const CFG=resolve(APP,'workerd-phase19/wrangler.jsonc');
const cfg=JSON.parse(readFileSync(CFG,'utf8'));
assert.equal(cfg.d1_databases[0].remote,false);
assert.equal(cfg.r2_buckets[0].remote,false);
assert.deepEqual(readdirSync(resolve(SVC,'migrations')).sort(),[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
]);
const SQL=readFileSync(resolve(SVC,
  'quote-proposals/0008_work_quote_drafts.sql'),'utf8');
const DDL=SQL.split('\n').filter(x=>!x.trim().startsWith('--'))
  .join('\n').split(';').map(x=>x.trim()).filter(Boolean);
assert.equal(DDL.length,2);
const SHOP='jill-work.myshopify.com';
const ID='jill:11111111-2222-4333-8444-555555555555';
const NO='jill:11111111-2222-4333-8444-555555555556';
const OP='jill:hq:quote:11111111-2222-4333-8444-555555555557';
const ORIGIN='https://jill-work.example';
const NOW=Date.parse('2026-10-17T15:20:00Z');
const detail={submission_id:ID,revision:4,items:[
  {item_id:'item-synthetic-1',quantity:2,title:'Synthetic only 1'},
  {item_id:'item-synthetic-2',quantity:3,title:'Synthetic only 2'},
]};
let sourceRev=4;
let session={shop:SHOP,isOnline:true,
  expires:new Date(Date.now()+600_000),
  onlineAccessInfo:{associated_user:{id:'123',account_owner:true},
    associated_user_scope:'read_orders,write_orders'},
};
const fees={materials:'5',labor:'20',shipping:'12',other:'3',
  discount:'10',tax:'4.56'};
const lines=[
  {id:'item-synthetic-1',quantity:2,unitPrice:'25.99'},
  {id:'item-synthetic-2',quantity:3,unitPrice:'0.01'},
];
const record=()=>({
  submission_id:ID,revision:sourceRev,customer_status:'reviewing',
  internal_status:'needs_quote',
  submitted_at:'2026-10-16T12:00:00Z',
  updated_at:'2026-10-17T14:00:00Z',date_needed:'2026-11-01',
  fulfillment:'pickup',item_count:2,
});
const list=async()=>({
  version:1,operation:'custom_order.merchant.list.result',
  ok:true,shop:SHOP,complete:true,records:[record()],
});
let detailCalls=0,authCalls=0,listCalls=0;
const readList=async()=>{listCalls++;return list();};
const readDetail=async()=>{detailCalls++;
  return {...detail,revision:sourceRev};
};
const auth={admin:async()=>{authCalls++;return {session};}};
function request(id=ID,method='GET',path='/app/requests/quote-draft'){
  return new Request(ORIGIN+path+'?submission_id='+encodeURIComponent(id),{
    method,redirect:'manual',
  });
}
const harness=createTestHarness({root:APP,workers:[{configPath:CFG}]});
let started=false,checks=0;
const yes=(v,msg)=>{assert.ok(v,msg);checks++;};
try{
  await harness.listen();started=true;
  const env=await harness.getWorker(cfg.name).getEnv();
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  for(const stmt of DDL)await db.prepare(stmt).run();
  for(const stmt of [
    'CREATE TABLE jill_merchant_authority (shop TEXT,environment TEXT,app_client_id TEXT,owner_staff_id TEXT,policy_version INTEGER)',
    'CREATE TABLE jill_merchant_grants (shop TEXT,staff_id TEXT,role TEXT,active INTEGER,capabilities_json TEXT)',
  ])await db.prepare(stmt).run();
  await db.prepare('INSERT INTO jill_merchant_authority VALUES (?,?,?,?,?)')
    .bind(SHOP,'WORK','f8e1ebdbae84490dc8ea5b133637e6c0','123',1).run();
  const invoke=async({enabled=true,req=request()}={})=>{
    const res=await handleWorkQuoteDraftRead({
      request:req,enabled,authenticate:auth,db,
      readFreshList:readList,readExactDetail:readDetail,
    });
    assert.equal(res.headers.get('cache-control'),
      'private, no-store, max-age=0');
    return {status:res.status,data:await res.json()};
  };
  let x=await invoke({enabled:false});
  assert.equal(x.status,503);assert.equal(x.data.code,'quote_drafts_not_enabled');
  assert.equal(authCalls,0);assert.equal(listCalls,0);checks+=4;
  x=await invoke({req:request(ID,'POST')});
  assert.equal(x.status,405);checks++;
  session={...session,shop:'jillonlinestore.myshopify.com'};
  x=await invoke();
  assert.equal(x.status,403);assert.equal(listCalls,0);checks+=2;
  session={shop:SHOP,isOnline:true,expires:new Date(Date.now()+600_000),
    onlineAccessInfo:{associated_user:{id:'123',account_owner:true},
      associated_user_scope:'read_orders,write_orders'}};
  x=await invoke({req:request('invalid/request/id')});
  assert.equal(x.status,400);checks++;
  x=await invoke({req:request(ID,'GET','/app/requests/quote-draft?extra=1&unused=1')});
  assert.equal(x.status,400);checks++;
  x=await invoke({req:request(NO)});
  assert.equal(x.status,404);checks++;
  x=await invoke();
  assert.equal(x.status,200);assert.equal(x.data.code,'no_saved_draft');
  assert.equal(x.data.state,'none');checks+=3;

  const write=planLocalWorkQuoteDraftSave({
    shop:SHOP,submissionId:ID,detail,record:record(),lines,fees,
    expectedDraftRevision:0,operationId:OP,nowMs:NOW,
  });
  await db.batch(write.statements.map(s=>db.prepare(s.sql).bind(...s.params)));
  x=await invoke();
  assert.equal(x.status,200);assert.equal(x.data.code,'draft_ready');
  const restored=hydrateVerifiedWorkQuoteWorksheet({
    draft:x.data.draft,detail,submissionId:ID,
  });
  yes(restored!==null);
  assert.equal(restored.draftRevision,1);
  assert.equal(restored.prices['item-synthetic-1'],'25.99');
  assert.equal(restored.prices['item-synthetic-2'],'0.01');
  assert.equal(restored.fees.shipping,'12.00');
  assert.equal(restored.estimatedTotalCents,8657);
  assert.equal(restored.saveRequested,false);
  assert.equal(restored.customerApprovalGranted,false);
  assert.equal('customer' in x.data.draft,false);
  assert.equal('quote_json' in x.data.draft,false);
  checks+=10;

  const sql='SELECT shop,submission_id,draft_revision,source_revision,'+
    'source_sha256,quote_sha256,quote_json,total_cents,currency,state,'+
    'updated_at_ms FROM jill_work_quote_drafts WHERE shop=? AND submission_id=?';
  const row=await db.prepare(sql).bind(SHOP,ID).first();
  const bad=t=>assert.throws(()=>projectVerifiedWorkQuoteDraft({
    row:t,detail,submissionId:ID,
  }),/unverified_quote_draft|stale_quote_draft_source/);
  bad({...row,total_cents:42});checks++;
  bad({...row,quote_sha256:'a'.repeat(64)});checks++;
  bad({...row,source_sha256:'b'.repeat(64)});checks++;
  bad({...row,shop:'jillonlinestore.myshopify.com'});checks++;
  bad({...row,source_revision:2});checks++;
  bad({...row,quote_json:'{' });checks++;
  bad({...row,quote_json:JSON.stringify({...JSON.parse(row.quote_json),
    total_cents:1})});checks++;
  bad({...row,quote_json:JSON.stringify({...JSON.parse(row.quote_json),
    items:[{item_id:'different-item',quantity:2,unit_price_cents:2599},
      {item_id:'item-synthetic-2',quantity:3,unit_price_cents:1}]})});checks++;
  yes(hydrateVerifiedWorkQuoteWorksheet({
    draft:{...x.data.draft,estimated_total_cents:5},
    detail,submissionId:ID,
  })===null);
  yes(hydrateVerifiedWorkQuoteWorksheet({
    draft:{...x.data.draft,lines:[...x.data.draft.lines].reverse()},
    detail,submissionId:ID,
  })===null);
  yes(hydrateVerifiedWorkQuoteWorksheet({
    draft:x.data.draft,detail:{...detail,revision:5},
    submissionId:ID,
  })===null);

  // Read refuses saved row if the signed canonical revision changed.
  sourceRev=5;
  x=await invoke();
  assert.equal(x.status,409);
  assert.equal(x.data.code,'source_revision_changed');checks+=2;
  sourceRev=4;
  await db.prepare('UPDATE jill_work_quote_drafts SET quote_sha256=? WHERE shop=? AND submission_id=?')
    .bind('a'.repeat(64),SHOP,ID).run();
  x=await invoke();
  assert.equal(x.status,503);
  assert.equal(x.data.code,'quote_draft_unverified');checks+=2;
  assert.equal(authCalls,8);assert.equal(listCalls,5);
  assert.equal(detailCalls,4);
  checks++;
  console.log('PASS WORK quote Save Draft RELOAD: '+checks+
    ' local D1/Shopify-Owner-stub cases, safe price hydration, exact source fingerprint, mismatched cents/hash/identity denial, hard OFF.');
  console.log('HOLD: only local synthetic data; no real WORK quote restored, migration, deployment, customer approval, payment, LIVE or KEEP.');
}catch(error){
  const kind=error?.name==='AssertionError'?'assertion':'local_fixture';
  const reason=String(error?.message||'unverified').replace(/[\r\n\t]+/g,' ').slice(0,240);
  console.error('STOP WORK quote reload '+kind+': '+reason);
  process.exitCode=1;
}finally{if(started)await harness.close().catch(()=>{process.exitCode=1;});}
