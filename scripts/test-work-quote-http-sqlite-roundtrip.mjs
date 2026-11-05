// JILL HQ WORK — full HTTP handler quote Save/Reload against isolated SQLite.
// Intentionally synthetic and OFF in all deployed Worker manifests.
// No Shopify, Google, Cloudflare, D1 remote or customer network calls.
// This test exercises real merchant auth POLICY, source projection, save/read,
// idempotency/CAS and remote-style D1.batch atomicity.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleWorkQuoteDraftSave}
 from '../services/jill-order-desk/work-quote-save-boundary.mjs';
import {handleWorkQuoteDraftRead}
 from '../services/jill-order-desk/work-quote-draft-read.mjs';
import {JILL_WORK_MERCHANT_CLIENT_ID}
 from '../backend/jill-merchant-auth.mjs';
import {prepareWorkQuoteUiSavePayload}
 from '../services/jill-order-desk/work-quote-ui-payload.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:fixture:quote:http12345';
const ITEM='item:fixture:http001';
const ORIGIN='https://work-hq.example.invalid';
const NOW=1792860012345;
const OP=n=>'jill:hq:quote:00000000-0000-4000-8000-'+
 String(n).padStart(12,'0');
const fees={materials:'1.00',labor:'5.00',shipping:'0.00',
 other:'0.00',discount:'0.50',tax:'0.25'};
const detail={submission_id:ID,revision:3,items:[
 {item_id:ITEM,title:'Synthetic party favor',quantity:2},
]};
const row={submission_id:ID,revision:3,customer_status:'reviewing',
 internal_status:'needs_quote',submitted_at:'2026-10-24T12:00:00Z',
 updated_at:'2026-10-24T12:01:00Z',date_needed:'2026-11-03',
 fulfillment:'pickup',item_count:1,
 owner_customer_gid:'NEVER_LEAK_PRIVATE_CUSTOMER',
 customer_email:'NEVER_LEAK_PRIVATE_EMAIL'};
const list=()=>({version:1,operation:'custom_order.merchant.list.result',
 ok:true,shop:SHOP,complete:true,records:[row]});
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(`
 CREATE TABLE jill_merchant_authority(
  shop TEXT PRIMARY KEY,environment TEXT,app_client_id TEXT,
  owner_staff_id TEXT,policy_version INTEGER
 );
 CREATE TABLE jill_merchant_grants(
  shop TEXT,staff_id TEXT,role TEXT,active INTEGER,capabilities_json TEXT,
  PRIMARY KEY(shop,staff_id)
 );
 INSERT INTO jill_merchant_authority VALUES
 ('jill-work.myshopify.com','WORK','${JILL_WORK_MERCHANT_CLIENT_ID}','123',1);
 CREATE TABLE jill_work_quote_drafts(
  shop TEXT NOT NULL,submission_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL,source_revision INTEGER NOT NULL,
  source_sha256 TEXT NOT NULL,quote_sha256 TEXT NOT NULL,
  quote_json TEXT NOT NULL,total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,state TEXT NOT NULL,
  last_operation_id TEXT NOT NULL,created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY(shop,submission_id)
 );
 CREATE TABLE jill_work_quote_draft_operations(
  shop TEXT NOT NULL,operation_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,draft_revision INTEGER NOT NULL,
  quote_sha256 TEXT NOT NULL,created_at_ms INTEGER NOT NULL,
  PRIMARY KEY(shop,operation_id)
 );
`);
// D1 mock speaks the real prepare().bind(...).first()/all()/run()/batch()
// interface, forwarding actual SQL unchanged into SQLite transactions.
const wrap=(sql,args=[])=>({
 sql,args,
 bind(...params){return wrap(sql,params)},
 async first(){return sqlite.prepare(sql).get(...args)??null},
 async all(){return {results:sqlite.prepare(sql).all(...args)}},
 async run(){const info=sqlite.prepare(sql).run(...args);
  return {success:true,meta:{changes:info.changes},results:[]};},
});
const db={
 prepare:sql=>wrap(sql),
 async batch(statements){
  sqlite.exec('BEGIN IMMEDIATE');
  try{
   const results=[];
   for(const statement of statements){
    if(/\bRETURNING\b/i.test(statement.sql)){
     const rows=sqlite.prepare(statement.sql).all(...statement.args);
     results.push({success:true,results:rows});
    }else{
     const info=sqlite.prepare(statement.sql).run(...statement.args);
     results.push({success:true,results:[],meta:{changes:info.changes}});
    }
   }
   sqlite.exec('COMMIT');
   return results;
  }catch(error){
   sqlite.exec('ROLLBACK');
   throw error;
  }
 },
};
const count=table=>sqlite.prepare('SELECT count(*) AS n FROM '+table).get().n;
const version=()=>sqlite.prepare('SELECT draft_revision FROM jill_work_quote_drafts')
 .get()?.draft_revision??0;
let owner=true,shop=SHOP,sourceRevision=3;
const counters={auth:0,list:0,detail:0};
const authenticate={admin:async()=>{
 counters.auth++;
 return {session:{shop,isOnline:true,
  expires:new Date(Date.now()+600000),
  onlineAccessInfo:{associated_user:{id:123,account_owner:owner},
   associated_user_scope:'read_products'}}};
}};
const readFreshList=async()=>{counters.list++;
 return {...list(),records:[{...row,revision:sourceRevision}]};};
const readExactDetail=async()=>{counters.detail++;
 return {...detail,revision:sourceRevision};};
const common={authenticate,db,readFreshList,readExactDetail,
 now:()=>NOW};
const reqSave=(payload,origin=ORIGIN)=>new Request(
 ORIGIN+'/app/requests/quote-draft',{
  method:'POST',headers:{'content-type':'application/json',origin},
  body:JSON.stringify(payload),
 });
const reqRead=(id=ID)=>new Request(
 ORIGIN+'/app/requests/quote-draft?submission_id='+encodeURIComponent(id));
const payload=(price,rev,op)=>prepareWorkQuoteUiSavePayload({
 submissionId:ID,detail,sourceRevision:3,customerStatus:'reviewing',
 prices:{[ITEM]:price},fees,draftRevision:rev,operationId:op,
}).payload;
const save=(p,enabled=true)=>handleWorkQuoteDraftSave({
 ...common,request:reqSave(p),enabled});
const read=(enabled=true)=>handleWorkQuoteDraftRead({
 ...common,request:reqRead(),enabled});
try{
 const p1=payload('25.00',0,OP(1));
 // OFF must refuse BEFORE Shopify auth, source read or D1 writes.
 let r=await save(p1,false);
 assert.equal(r.status,503);
 assert.equal((await r.json()).code,'quote_drafts_not_enabled');
 assert.deepEqual(counters,{auth:0,list:0,detail:0});
 assert.equal(version(),0);
 r=await read(false);
 assert.equal(r.status,503);
 assert.deepEqual(counters,{auth:0,list:0,detail:0});

 r=await save(p1,true);
 assert.equal(r.status,200);
 let data=await r.json();
 assert.equal(data.code,'draft_saved');
 assert.equal(data.revision,1);
 assert.equal(data.duplicate,false);
 assert.equal(version(),1);
 assert.equal(count('jill_work_quote_draft_operations'),1);
 r=await read(true);
 assert.equal(r.status,200);
 data=await r.json();
 assert.equal(data.code,'draft_ready');
 assert.equal(data.draft.lines[0].unitPrice,'25.00');
 assert.equal(data.draft.draft_revision,1);
 assert.equal(data.draft.estimated_total_cents,5575);
 assert.equal(data.draft.customer_approved,false);
 assert.equal(data.draft.invoice_sent,false);
 assert.equal(data.draft.payment_confirmed,false);
 assert.equal(JSON.stringify(data).includes('NEVER_LEAK'),false);

 // Same operation id + payload: receipt replay proves idempotency.
 r=await save(p1);
 data=await r.json();
 assert.equal(r.status,200);
 assert.equal(data.duplicate,true);
 assert.equal(data.revision,1);
 assert.equal(count('jill_work_quote_draft_operations'),1);

 // Stale competing update at expected 0 does not overwrite anything.
 r=await save(payload('27.00',0,OP(2)));
 assert.equal(r.status,409);
 assert.equal((await r.json()).code,'draft_revision_changed');
 assert.equal(version(),1);
 assert.equal(count('jill_work_quote_draft_operations'),1);

 // Legitimate Owner after verified Reload can make a new revision.
 r=await save(payload('26.50',1,OP(3)));
 assert.equal(r.status,200);
 assert.equal((await r.json()).revision,2);
 assert.equal(version(),2);
 assert.equal(count('jill_work_quote_draft_operations'),2);
 r=await read();
 data=await r.json();
 assert.equal(data.draft.lines[0].unitPrice,'26.50');
 assert.equal(data.draft.estimated_total_cents,5875);

 // Foreign shop, non-owner and foreign origin can never write.
 let writes=count('jill_work_quote_draft_operations');
 shop='live-shop.myshopify.com';
 r=await save(payload('30.00',2,OP(4)));
 assert.equal(r.status,403);
 assert.equal(count('jill_work_quote_draft_operations'),writes);
 shop=SHOP;owner=false;
 r=await save(payload('30.00',2,OP(4)));
 assert.equal(r.status,403);
 assert.equal(count('jill_work_quote_draft_operations'),writes);
 owner=true;
 r=await handleWorkQuoteDraftSave({
  ...common,enabled:true,
  request:reqSave(payload('30.00',2,OP(4)),
   'https://evil.example.invalid'),
 });
 assert.equal(r.status,403);
 assert.equal(count('jill_work_quote_draft_operations'),writes);

 // Fresh canonical request revised: both save and reload must reject
 // old draft instead of pricing against an obsolete Custom Order.
 sourceRevision=4;
 r=await read();
 assert.equal(r.status,409);
 assert.equal((await r.json()).code,'source_revision_changed');
 r=await save(payload('30.00',2,OP(4)));
 assert.equal(r.status,409);
 assert.equal((await r.json()).code,'source_revision_changed');
 assert.equal(version(),2);
 assert.equal(count('jill_work_quote_draft_operations'),writes);
 sourceRevision=3;
 // Exact operation reconciliation is read-only and scoped by the Owner.
 const reconcile=async(op,expected)=>{
  const url=new URL(reqRead().url);
  url.searchParams.set('operation_id',op);
  url.searchParams.set('expected_draft_revision',String(expected));
  return handleWorkQuoteDraftRead({...common,enabled:true,request:new Request(url)});
 };
 let recovered=await (await reconcile(OP(3),1)).json();
 assert.equal(recovered.recovery.state,'committed');
 assert.equal(recovered.recovery.operation_id,OP(3));
 assert.match(recovered.recovery_scope,/^[a-f0-9]{64}$/);
 recovered=await (await reconcile(OP(999),1)).json();
 assert.equal(recovered.recovery.state,'not_applied',
  'Missing receipt + CAS advanced means the old write cannot commit later');
 recovered=await (await reconcile(OP(999),2)).json();
 assert.equal(recovered.recovery.state,'unresolved',
  'No receipt at current CAS revision never proves an uncertain write failed');
 recovered=await (await reconcile(OP(1),0)).json();
 assert.equal(recovered.recovery.state,'committed','Earlier exact receipt survives later revisions');
 recovered=await (await reconcile(OP(1),1)).json();
 assert.equal(recovered.recovery.state,'conflict','Wrong expected revision cannot borrow a receipt');
 assert.equal(count('jill_work_quote_draft_operations'),writes);
 assert.equal((await reconcile(OP(3),'01')).status,400);
 owner=false;
 assert.equal((await reconcile(OP(3),1)).status,403);
 owner=true;
 // A genuinely delayed transaction remains invisible while its HTTP
 // handler is still alive. Neither old-row read nor missing receipt settles it.
 const realBatch=db.batch;
 let release,started;
 const waiting=new Promise(resolve=>{started=resolve;});
 db.batch=async statements=>{
  started();
  await new Promise(resolve=>{release=resolve;});
  return realBatch(statements);
 };
 const late=save(payload('28.00',2,OP(99)));
 await waiting;
 recovered=await (await reconcile(OP(99),2)).json();
 assert.equal(recovered.draft.draft_revision,2);
 assert.equal(recovered.recovery.state,'unresolved');
 release();
 assert.equal((await late).status,200);
 db.batch=realBatch;
 recovered=await (await reconcile(OP(99),2)).json();
 assert.equal(recovered.recovery.state,'committed');
 assert.equal(recovered.draft.draft_revision,3);
 // Competing tabs: one CAS winner. The losing delayed operation has
 // no receipt and cannot write later against the winner's revision.
 const results=await Promise.all([
  save(payload('29.00',3,OP(100))),save(payload('30.00',3,OP(101))),
 ]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
 const loser=results[0].status===409?OP(100):OP(101);
 recovered=await (await reconcile(loser,3)).json();
 assert.equal(recovered.recovery.state,'not_applied');
 assert.equal(version(),4);
 // Corrupted DB amount/hash must stop at server projection.
 sqlite.exec("UPDATE jill_work_quote_drafts SET quote_sha256='"+'a'.repeat(64)+"'");
 r=await read();
 assert.equal(r.status,503);
 assert.equal((await r.json()).code,'quote_draft_unverified');
 assert.equal(version(),4);

 console.log('PASS: Quote HTTP/SQLite: OFF zero reads, idempotency, delayed commit, competing CAS writers, exact operation reconciliation, stale source/foreign Owner/origin denial, corruption HOLD. No provider calls.');
}finally{sqlite.close();}
