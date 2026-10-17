// WORK merchant quote Save Draft adapter tested against genuine LOCAL D1.
// Does not run an HTTP server route, access a real Shopify session, read
// Google QA or migrate remote D1. All item data and grants are synthetic.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestHarness} from 'wrangler';
import {handleWorkQuoteDraftSave as save}
  from '../../work-quote-save-boundary.mjs';
import {projectWorkMerchantInbox}
  from '../../merchant-inbox-read.mjs';
import {planLocalWorkQuoteDraftSave as plan}
  from '../../work-quote-draft-plan.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const SVC=resolve(ROOT,'services/jill-order-desk');
const CFG=resolve(APP,'workerd-phase19/wrangler.jsonc');
const cfg=JSON.parse(readFileSync(CFG,'utf8'));
assert.equal(cfg.name,'jill-work-phase19-local-media-only');
assert.equal(cfg.d1_databases[0].remote,false);
assert.equal(cfg.d1_databases[0].database_id,
  '00000000-0000-4000-8000-000000000019');
assert.equal(cfg.r2_buckets[0].remote,false);
assert.deepEqual(readdirSync(resolve(SVC,'migrations')).sort(),[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
]);
const SQL=readFileSync(resolve(SVC,
  'quote-proposals/0008_work_quote_drafts.sql'),'utf8');
assert.match(SQL,/INERT SOURCE-ONLY/);
const ddls=SQL.split('\n').filter(line=>!line.trim().startsWith('--'))
  .join('\n').split(';').map(x=>x.trim()).filter(Boolean);
assert.equal(ddls.length,2);
const SHOP='jill-work.myshopify.com';
const ID='jill:22222222-3333-4444-8555-666666666666';
const OP1='jill:hq:quote:11111111-2222-4333-8444-555555555555';
const OP2='jill:hq:quote:11111111-2222-4333-8444-555555555556';
const OP3='jill:hq:quote:11111111-2222-4333-8444-555555555557';
const ORIGIN='https://jill-work.example';
const NOW=Date.parse('2026-10-17T15:00:00Z');
let authCount=0,sourceCount=0,detailCount=0,nowCalls=0;
let status='reviewing',sourceRevision=3;
const list=async()=>{
  sourceCount++;
  return {version:1,operation:'custom_order.merchant.list.result',
    ok:true,shop:SHOP,complete:true,
    records:[{
      submission_id:ID,revision:sourceRevision,customer_status:status,
      internal_status:'needs_quote',
      submitted_at:'2026-10-16T12:00:00Z',
      updated_at:'2026-10-17T13:00:00Z',
      date_needed:'2026-11-01',fulfillment:'pickup',item_count:2,
    }],
  };
};
const detail=async({submissionId})=>{
  detailCount++;assert.equal(submissionId,ID);
  return {submission_id:ID,revision:sourceRevision,
    items:[{item_id:'item-a',quantity:2,title:'Synthetic item A'},
      {item_id:'item-b',quantity:3,title:'Synthetic item B'}]};
};
const goodSession={
  shop:SHOP,isOnline:true,
  expires:new Date(Date.now()+600000),
  onlineAccessInfo:{associated_user:{id:'123',account_owner:true},
    associated_user_scope:'read_orders,write_orders'},
};
let session=goodSession;
const authenticate={admin:async()=>{
  authCount++;
  return {session};
}};
const fees={
  materials:'5',labor:'20',shipping:'12',
  other:'3',discount:'10',tax:'4.56',
};
const lines=[
  {id:'item-a',quantity:2,unitPrice:'25.99'},
  {id:'item-b',quantity:3,unitPrice:'0.01'},
];
const body={
  submission_id:ID,operation_id:OP1,source_revision:3,
  expected_draft_revision:0,lines,fees,
};
function make(value=body,origin=ORIGIN){
  return new Request(ORIGIN+'/app/requests/quote-draft',{
    method:'POST',headers:{origin,'content-type':'application/json'},
    body:JSON.stringify(value),
  });
}
const harness=createTestHarness({root:APP,workers:[{configPath:CFG}]});
let started=false,tests=0;
try{
  await harness.listen();started=true;
  const worker=harness.getWorker(cfg.name);
  const env=await worker.getEnv();
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  assert.equal(typeof db.batch,'function');
  for(const stmt of ddls)await db.prepare(stmt).run();
  await db.prepare('CREATE TABLE jill_merchant_authority ('+
    'shop TEXT, environment TEXT, app_client_id TEXT,'+
    'owner_staff_id TEXT, policy_version INTEGER)').run();
  await db.prepare('CREATE TABLE jill_merchant_grants ('+
    'shop TEXT, staff_id TEXT, role TEXT, active INTEGER,'+
    'capabilities_json TEXT)').run();
  await db.prepare('INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,policy_version) '+
    'VALUES (?,?,?,?,?)')
    .bind(SHOP,'WORK','f8e1ebdbae84490dc8ea5b133637e6c0','123',1).run();
  const invoke=async(value=body,origin=ORIGIN,enabled=true)=>{
    const response=await save({
      request:make(value,origin),enabled,authenticate,db,
      readFreshList:list,readExactDetail:detail,now:()=>NOW+(nowCalls++),
    });
    assert.equal(response.headers.get('cache-control'),
      'private, no-store, max-age=0');
    return {status:response.status,body:await response.json()};
  };
  let result=await invoke(body,ORIGIN,false);
  assert.deepEqual(result,{status:503,body:{
    ok:false,code:'quote_drafts_not_enabled'}});
  assert.equal(authCount,0);assert.equal(sourceCount,0);
  tests+=3;
  session={...goodSession,shop:'jillonlinestore.myshopify.com'};
  result=await invoke();
  assert.equal(result.status,403);
  assert.equal(sourceCount,0);
  tests+=2;
  session=goodSession;
  result=await invoke(body,'https://jillonlinestore.com');
  assert.equal(result.status,403);
  assert.equal(result.body.code,'invalid_origin');
  assert.equal(sourceCount,0);
  tests+=3;
  result=await invoke({...body,lines:[{
    ...lines[0],quantity:99,
  },lines[1]]});
  assert.equal(result.status,503); // source snapshot invalid
  assert.equal(result.body.code,'canonical_quote_source_unavailable');
  tests+=2;
  result=await invoke({...body,source_revision:2});
  assert.equal(result.status,409);
  assert.equal(result.body.code,'source_revision_changed');
  tests+=2;
  // Verify the synthetic source and pure plan contract independently
  // before testing the adapter. A failure here is not D1 or OAuth.
  const snapshot=projectWorkMerchantInbox(await list());
  assert.equal(snapshot.records.length,1);
  const sourceDetail=await detail({submissionId:ID});
  const planned=plan({
    shop:SHOP,submissionId:ID,detail:sourceDetail,
    record:snapshot.records[0],lines,fees,
    expectedDraftRevision:0,operationId:OP1,nowMs:NOW,
  });
  assert.equal(planned.next_draft_revision,1);
  result=await invoke();
  assert.equal(result.status,200,'first_save_'+result.body.code);
  assert.equal(result.body.code,'draft_saved');
  assert.equal(result.body.revision,1);
  assert.equal(result.body.duplicate,false);
  assert.equal((await db.prepare('SELECT count(*) AS n '+
    'FROM jill_work_quote_draft_operations').first()).n,1);
  tests+=5;
  result=await invoke();
  assert.equal(result.status,200);
  assert.equal(result.body.duplicate,true);
  assert.equal(result.body.revision,1);
  tests+=3;
  const body2={...body,operation_id:OP2,expected_draft_revision:1,
    lines:[{...lines[0],unitPrice:'30'},lines[1]]};
  result=await invoke(body2);
  assert.equal(result.status,200);
  assert.equal(result.body.revision,2);
  assert.equal(result.body.duplicate,false);
  tests+=3;
  result=await invoke({...body,operation_id:OP3});
  assert.equal(result.status,409);
  assert.equal(result.body.code,'draft_revision_changed');
  tests+=2;
  // Operation ID reuse with altered content must not rewrite a quote.
  result=await invoke({...body2,operation_id:OP1,
    expected_draft_revision:2});
  assert.equal(result.status,409);
  assert.equal(result.body.code,'draft_revision_changed');
  tests+=2;
  sourceRevision=4;
  result=await invoke({...body2,operation_id:OP3,
    source_revision:4,expected_draft_revision:2});
  assert.equal(result.status,409);
  assert.equal(result.body.code,'draft_revision_changed');
  tests+=2;
  status='cancelled';
  result=await invoke({...body2,operation_id:OP3,source_revision:4});
  assert.equal(result.status,503);
  assert.equal(result.body.code,'canonical_quote_source_unavailable');
  tests+=2;
  const row=await db.prepare('SELECT * FROM jill_work_quote_drafts')
    .first();
  assert.equal(row.draft_revision,2);
  assert.equal(row.total_cents,9459);
  assert.equal((await db.prepare('SELECT count(*) AS n '+
    'FROM jill_work_quote_draft_operations').first()).n,2);
  tests+=3;
  for(const secret of ['customer','@example','image_url','raw_payload',
    'reference_ids','jillonlinestore.com'])
    assert.equal(JSON.stringify(row).includes(secret),false);
  tests+=6;
  assert.ok(authCount>=10&&sourceCount>=8&&detailCount>=7);
  assert.equal((await worker.fetch('http://localhost/quote')).status,404);
  tests+=2;
  console.log('PASS WORK quote Save Draft owner boundary: '+tests+
    ' LOCAL D1/Shopify-session-stub cases, feature OFF, authenticated Owner, Origin, canonical revision, duplicate receipt, CAS and privacy.');
  console.log('HOLD: no real Shopify login/Google data, no enabled HTTP route, remote D1 migration, quote approval, payment, LIVE/KEEP or release.');
}catch(error){
  // The fixture is entirely synthetic. Report only safe assertion/SQL
  // diagnostic text, never session values or raw records.
  const type=error?.name==='AssertionError'?'assertion':'local_d1';
  const detail=String(error?.message||'unverified').replace(
    /[\r\n\t]+/g,' ').slice(0,240);
  console.error('STOP WORK quote Save Draft LOCAL owner boundary '+type+
    ': '+detail+'; remote unchanged.');
  process.exitCode=1;
}finally{
  if(started)await harness.close().catch(()=>{process.exitCode=1;});
}
