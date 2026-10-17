// WORK-only authenticated merchant quote draft boundary (SOURCE ONLY).
// Router must keep this OFF unless a later separately authorized version,
// remote D1 migration and release have all been explicitly approved.
// No general-purpose D1 writes; the only query pair comes from audited
// synthetic quote plan. No client-supplied session, shop or source record.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {projectWorkMerchantInbox} from './merchant-inbox-read.mjs';
import {planLocalWorkQuoteDraftSave as plan,
  inspectLocalWorkQuoteDraftReceipt as inspect}
  from './work-quote-draft-plan.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const MAX_BODY=24*1024;
const FEE=['materials','labor','shipping','other','discount','tax'];
const KEYS=['submission_id','operation_id','source_revision',
  'expected_draft_revision','lines','fees'];
const HEADERS={'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff'};
const respond=(status,code,extra={})=>Response.json({
  ok:status===200,code,...extra,
},{status,headers:HEADERS});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const shape=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&
  keys.every(k=>Object.hasOwn(x,k));
async function boundedInput(request){
  if(request.headers.get('content-type')?.split(';')[0]?.toLowerCase()!==
     'application/json')throw Error('invalid_content_type');
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^[0-9]{1,6}$/.test(length)||
      Number(length)>MAX_BODY))throw Error('large_body');
  if(!request.body)throw Error('body_missing');
  const reader=request.body.getReader();
  let n=0,chunks=[];
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      n+=value.byteLength;
      if(n>MAX_BODY)throw Error('large_body');
      chunks.push(value);
    }
  }finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(n);let at=0;
  for(const piece of chunks){bytes.set(piece,at);at+=piece.byteLength;}
  const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!shape(parsed,KEYS)||typeof parsed.submission_id!=='string'||
     !ID.test(parsed.submission_id)||
     !Number.isSafeInteger(parsed.source_revision)||
     parsed.source_revision<1||parsed.source_revision>100||
     !Number.isSafeInteger(parsed.expected_draft_revision)||
     parsed.expected_draft_revision<0||
     parsed.expected_draft_revision>=100||
     !Array.isArray(parsed.lines)||parsed.lines.length===0||
     parsed.lines.length>50||!shape(parsed.fees,FEE)||
     !FEE.every(k=>typeof parsed.fees[k]==='string')||
     parsed.lines.some(x=>!shape(x,['id','quantity','unitPrice'])||
       typeof x.id!=='string'||typeof x.unitPrice!=='string'||
       !Number.isSafeInteger(x.quantity)))
    throw Error('invalid_shape');
  return parsed;
}
async function lookupReceipt(db,binding){
  try {
    return await db.prepare(binding.receipt_lookup.sql)
      .bind(...binding.receipt_lookup.params).first();
  }catch{return undefined;} // not proof of failure or success
}
async function readCurrent(db,submissionId){
  return db.prepare('SELECT draft_revision,quote_sha256,last_operation_id '+
    'FROM jill_work_quote_drafts WHERE shop=? AND submission_id=?')
    .bind(SHOP,submissionId).first();
}
function accepted(planReceipt,row,binding){
  const verdict=inspect({plan:binding,receipt:planReceipt});
  return verdict.kind==='matching_synthetic_operation_receipt'&&
    row?.draft_revision===binding.next_draft_revision&&
    row.quote_sha256===binding.quote_sha256;
}
/** @param {{
  request?: Request,
  enabled?: boolean,
  authenticate?: {admin: (request: Request)=>Promise<{session:any}>},
  db?: any,
  readFreshList?: ()=>Promise<any>,
  readExactDetail?: (args:{submissionId:string})=>Promise<any>,
  now?: ()=>number
}} [options] */
export async function handleWorkQuoteDraftSave({
  request,enabled=false,authenticate,db,readFreshList,readExactDetail,
  now=Date.now,
}={}){
  if(request?.method!=='POST')return respond(405,'method_not_allowed');
  // Hard off means no Shopify SDK, D1, customer source or body read.
  if(enabled!==true)return respond(503,'quote_drafts_not_enabled');
  if(typeof authenticate?.admin!=='function'||
     typeof db?.batch!=='function'||typeof db?.prepare!=='function'||
     typeof readFreshList!=='function'||
     typeof readExactDetail!=='function'||typeof now!=='function')
    return respond(503,'quote_drafts_unavailable');
  let access;
  try{
    const {session}=await authenticate.admin(request);
    access=await readWorkMerchantPermission({
      db,session,action:'requests.write',
    });
  }catch{return respond(403,'access_denied');}
  if(access.allowed!==true||access.role!=='owner')
    return respond(access.code==='authority_unavailable'?503:403,
      'access_denied');
  // Matching Origin is necessary but never sufficient for authorization.
  if(request.headers.get('origin')!==new URL(request.url).origin)
    return respond(403,'invalid_origin');
  let input;
  try{input=await boundedInput(request);}
  catch{return respond(400,'invalid_quote_draft');}

  let binding;
  try{
    const source=projectWorkMerchantInbox(await readFreshList());
    const matches=source.records.filter(x=>
      x.submission_id===input.submission_id);
    if(matches.length!==1||matches[0].revision!==input.source_revision)
      return respond(409,'source_revision_changed');
    const detail=await readExactDetail({
      submissionId:input.submission_id,
    });
    if(detail?.submission_id!==input.submission_id||
       detail.revision!==matches[0].revision||
       detail.items?.length!==matches[0].item_count)
      return respond(409,'source_revision_changed');
    binding=plan({
      shop:SHOP,submissionId:input.submission_id,
      detail,record:matches[0],lines:input.lines,fees:input.fees,
      expectedDraftRevision:input.expected_draft_revision,
      operationId:input.operation_id,nowMs:now(),
    });
  }catch{return respond(503,'canonical_quote_source_unavailable');}
  // The same operation may already have committed. Reconcile first.
  const already=await lookupReceipt(db,binding);
  if(already===undefined)return respond(503,'commit_unconfirmed');
  if(already!==null){
    try{
      const current=await readCurrent(db,binding.submission_id);
      if(accepted(already,current,binding))
        return respond(200,'draft_saved',{
          revision:binding.next_draft_revision,duplicate:true,
        });
    }catch{}
    return respond(409,'draft_revision_changed');
  }
  try{
    const results=await db.batch(binding.statements.map(x=>
      db.prepare(x.sql).bind(...x.params)));
    if(!Array.isArray(results)||results.length!==2)
      return respond(503,'commit_unconfirmed');
    // CAS miss is an ordinary conflict; no operation receipt appended.
    if(!Array.isArray(results[0]?.results)||
       results[0].results.length!==1)
      return respond(409,'draft_revision_changed');
  }catch{
    // Unknown transaction result: DO NOT automatically retry or
    // generate another operation ID, even if D1 reported an error.
    return respond(503,'commit_unconfirmed');
  }
  try{
    const receipt=await lookupReceipt(db,binding);
    const current=await readCurrent(db,binding.submission_id);
    if(receipt!==undefined && accepted(receipt,current,binding))
      return respond(200,'draft_saved',{
        revision:binding.next_draft_revision,duplicate:false,
      });
  }catch{}
  return respond(503,'commit_unconfirmed');
}
