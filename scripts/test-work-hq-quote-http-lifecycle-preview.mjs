// Synthetic end-to-end HTTP quote draft lifecycle against the exact
// WORK Owner handlers, with an in-memory D1 test double only. NO network,
// remote database access, Shopify mutation or Cloudflare resource changes.
import assert from 'node:assert/strict';
import {prepareWorkQuoteUiSavePayload} from '../services/jill-order-desk/work-quote-ui-payload.mjs';
import {handleWorkQuoteDraftSave} from '../services/jill-order-desk/work-quote-save-boundary.mjs';
import {handleWorkQuoteDraftRead} from '../services/jill-order-desk/work-quote-draft-read.mjs';
import {hydrateVerifiedWorkQuoteWorksheet} from '../services/jill-order-desk/work-quote-restore-model.mjs';
const SHOP='jill-work.myshopify.com';
const APP='f8e1ebdbae84490dc8ea5b133637e6c0';
const ROOT='https://jill-work.example';
const ID='jill:22222222-3333-4444-8555-666666666666';
const OP='jill:hq:quote:11111111-2222-4333-8444-555555555555';
const nowMs=Date.parse('2026-10-21T16:00:00Z');
const item={item_id:'item-custom-001',quantity:2,reference_ids:['private_ref_example'],
 attributes:[{id:'name',value:'PERSONALIZED_NOLEAK'}]};
const detail={submission_id:ID,revision:4,items:[item]};
const record={submission_id:ID,revision:4,customer_status:'reviewing',
 internal_status:'needs_quote',submitted_at:'2026-10-20T08:00:00Z',
 updated_at:'2026-10-20T09:00:00Z',date_needed:'2026-10-31',
 fulfillment:'shipping',item_count:1};
const list=()=>({version:1,operation:'custom_order.merchant.list.result',
 ok:true,shop:SHOP,complete:true,records:[record]});
const state={saved:null,receipt:null,batchCalls:0,listReads:0,detailReads:0,
 authCalls:0,dbReads:0};
function db(){
 return {
   prepare(sql){
    return{bind(...params){
      return {
        async first(){
          state.dbReads++;
          if(sql.includes('FROM jill_merchant_authority'))
            return {shop:SHOP,environment:'WORK',app_client_id:APP,
              owner_staff_id:'123',policy_version:1};
          if(sql.includes('FROM jill_merchant_grants'))return null;
          if(sql.includes('FROM jill_work_quote_draft_operations')){
            return state.receipt&&state.receipt.operation_id===params[1]?
             {submission_id:ID,draft_revision:state.receipt.draft_revision,
              quote_sha256:state.receipt.quote_sha256}:null;
          }
          if(sql.includes('FROM jill_work_quote_drafts'))return state.saved;
          throw Error('unexpected_sql');
        },
        sql,params,
      };
    }};
   },
   async batch(statements){
     state.batchCalls++;
     assert.equal(statements.length,2);
     assert.match(statements[0].sql,/^INSERT INTO jill_work_quote_drafts/);
     assert.match(statements[1].sql,/^INSERT INTO jill_work_quote_draft_operations/);
     const p=statements[0].params;
     const op=statements[1].params;
     if(state.saved)return [{results:[]},{results:[]}];
     state.saved={shop:p[0],submission_id:p[1],draft_revision:p[2],
       source_revision:p[3],source_sha256:p[4],quote_sha256:p[5],
       quote_json:p[6],total_cents:p[7],currency:p[8],state:p[9],
       last_operation_id:p[10],created_at_ms:p[11],updated_at_ms:p[12]};
     state.receipt={operation_id:op[1],draft_revision:p[2],quote_sha256:p[5]};
     return [{results:[{draft_revision:p[2],quote_sha256:p[5]}]},
       {results:[{}]}];
   },
 };
}
const database=db();
let owner=true,scopes='read_products';
const authenticate={async admin(){
 state.authCalls++;
 return {session:{shop:SHOP,isOnline:true,
  onlineAccessInfo:{associated_user:{id:123,account_owner:owner},
    associated_user_scope:scopes}}};
}};
const readFreshList=async()=>{state.listReads++;return list();};
const readExactDetail=async()=>{state.detailReads++;return detail;};
const fees={materials:'2.00',labor:'5.00',shipping:'7.00',
 other:'0.00',discount:'0.00',tax:'0.00'};
const prep=prepareWorkQuoteUiSavePayload({
 submissionId:ID,detail,sourceRevision:4,customerStatus:'reviewing',
 prices:{'item-custom-001':'25.00'},fees,draftRevision:0,
 operationId:OP,
});
assert.equal(prep.state,'ready');
assert.equal(prep.estimatedTotalCents,6400);
const saveReq=(body=prep.payload,origin=ROOT)=>new Request(ROOT+'/app/requests/quote-draft',{
 method:'POST',headers:{'content-type':'application/json',origin},
 body:JSON.stringify(body),
});
const getReq=()=>new Request(ROOT+'/app/requests/quote-draft?submission_id='+
 encodeURIComponent(ID));
const save=()=>handleWorkQuoteDraftSave({request:saveReq(),enabled:true,
 authenticate,db:database,readFreshList,readExactDetail,now:()=>nowMs});
const restore=()=>handleWorkQuoteDraftRead({request:getReq(),enabled:true,
 authenticate,db:database,readFreshList,readExactDetail});
let res=await save();
assert.equal(res.status,200);
let data=await res.json();
assert.equal(data.code,'draft_saved');
assert.equal(data.revision,1);
assert.equal(data.duplicate,false);
assert.equal(state.batchCalls,1);
res=await restore();assert.equal(res.status,200);
data=await res.json();
assert.equal(data.code,'draft_ready');assert.equal(data.draft.state,'ready');
const restored=hydrateVerifiedWorkQuoteWorksheet({
 draft:data.draft,detail,submissionId:ID,
});
assert.equal(restored.estimatedTotalCents,6400);
assert.equal(restored.prices['item-custom-001'],'25.00');
assert.equal(restored.draftRevision,1);
assert.equal(JSON.stringify(data).includes('PERSONALIZED_NOLEAK'),false);
assert.equal(JSON.stringify(data).includes('private_ref_example'),false);
res=await save();assert.equal(res.status,200);
data=await res.json();assert.equal(data.duplicate,true);
assert.equal(state.batchCalls,1); // idempotent: no second D1 batch
owner=false;
const before=state.listReads;
res=await restore();assert.equal(res.status,403);
res=await save();assert.equal(res.status,403);
assert.equal(state.listReads,before);
owner=true;scopes='';
res=await restore();assert.equal(res.status,200); // Owner requests.read has no Shopify scopes
scopes='read_products';
const badOrigin=await handleWorkQuoteDraftSave({request:saveReq(prep.payload,
 'https://untrusted.example'),enabled:true,authenticate,db:database,
 readFreshList,readExactDetail,now:()=>nowMs});
assert.equal(badOrigin.status,403);
const dirty=await handleWorkQuoteDraftSave({request:saveReq({
 ...prep.payload,claimed_owner:true}),enabled:true,authenticate,
 db:database,readFreshList,readExactDetail,now:()=>nowMs});
assert.equal(dirty.status,400);
const beforeBatch=state.batchCalls;
const staleList=async()=>({...list(),records:[{...record,revision:5}]});
res=await handleWorkQuoteDraftSave({request:saveReq(),enabled:true,
 authenticate,db:database,readFreshList:staleList,
 readExactDetail,now:()=>nowMs});
assert.equal(res.status,409);
assert.equal(state.batchCalls,beforeBatch);
res=await handleWorkQuoteDraftRead({request:getReq(),enabled:true,
 authenticate,db:database,readFreshList:staleList,readExactDetail});
assert.equal(res.status,409);
assert.equal(state.batchCalls,1);
console.log('PASS M2 synthetic Owner HTTP Save -> D1 receipt -> verified Reload, replay idempotency, A/B denial, stale-source/Origin/shape; no external effects');
