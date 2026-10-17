// WORK quote drafts: authenticated, read-only, verified same-request restore.
// SOURCE ONLY: the actual Worker/React Router endpoint remains HARD OFF.
// The saved row and price breakdown are never trusted without the original
// authenticated Owner, WORK D1 grant and fresh signed canonical source.
import {createHash} from 'node:crypto';
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {projectWorkMerchantInbox} from './merchant-inbox-read.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const HASH=/^[0-9a-f]{64}$/;
const FEES=['materials','labor','shipping','other','discount','tax'];
const MAX_TOTAL=100_000_000;
const HEADER={'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff'};
const result=(status,code,extra={})=>Response.json({
  ok:status===200,code,...extra,
},{status,headers:HEADER});
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const shape=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&
  keys.every(k=>Object.hasOwn(v,k));
const validCent=x=>Number.isSafeInteger(x)&&x>=0&&x<=MAX_TOTAL;
const fail=code=>{throw Error(code);};
const immutable=o=>Object.freeze(o);
const asMoney=x=>{
  if(!validCent(x))fail('unverified_quote_draft');
  return (Math.trunc(x/100)).toString()+'.'+
    (x%100).toString().padStart(2,'0');
};

/** Validate every stored cent against the independently signed request.
 * Any changed request revision is a conflict, never a silent restore.
 * Never return raw quote_json, row, source labels or customer information.
 */
export function projectVerifiedWorkQuoteDraft({row,detail,submissionId}={}){
  if(!ID.test(submissionId||'')||
     !object(detail)||detail.submission_id!==submissionId||
     !Number.isSafeInteger(detail.revision)||detail.revision<1||
     detail.revision>100||!Array.isArray(detail.items)||
     detail.items.length<1||detail.items.length>50||
     !object(row)||row.shop!==SHOP||
     row.submission_id!==submissionId||
     row.currency!=='USD'||row.state!=='draft'||
     !Number.isSafeInteger(row.draft_revision)||
     row.draft_revision<1||row.draft_revision>100||
     !Number.isSafeInteger(row.source_revision)||
     row.source_revision<1||row.source_revision>100||
     !HASH.test(row.source_sha256||'')||
     !HASH.test(row.quote_sha256||'')||
     !validCent(row.total_cents)||
     typeof row.quote_json!=='string'||
     Buffer.byteLength(row.quote_json,'utf8')>25000||
     !Number.isSafeInteger(row.updated_at_ms)||row.updated_at_ms<1_600_000_000_000)
    fail('unverified_quote_draft');
  // If the canonical event revision advanced since quoting, stop. This
  // prevents silently pricing from the old status/detail snapshot.
  if(row.source_revision!==detail.revision)
    fail('stale_quote_draft_source');
  let saved;
  try{saved=JSON.parse(row.quote_json);}
  catch{fail('unverified_quote_draft');}
  if(!shape(saved,['version','currency','source_revision','items',
    'fees_cents','subtotal_cents','total_cents'])||
     saved.version!==1||saved.currency!=='USD'||
     saved.source_revision!==row.source_revision||
     !Array.isArray(saved.items)||
     saved.items.length!==detail.items.length||
     !shape(saved.fees_cents,FEES)||
     !FEES.every(k=>validCent(saved.fees_cents[k]))||
     !validCent(saved.subtotal_cents)||
     !validCent(saved.total_cents)||
     saved.total_cents!==row.total_cents||
     hash('jill_work_quote_draft_v1\n'+row.quote_json)!==row.quote_sha256)
    fail('unverified_quote_draft');
  let subtotal=0;
  const units=[];
  const identity=[];
  const seen=new Set();
  for(let i=0;i<saved.items.length;i++){
    const item=saved.items[i],original=detail.items[i];
    if(!shape(item,['item_id','quantity','unit_price_cents'])||
       !object(original)||!ID.test(item.item_id||'')||
       item.item_id!==original.item_id||seen.has(item.item_id)||
       !Number.isSafeInteger(original.quantity)||
       original.quantity<1||original.quantity>999||
       item.quantity!==original.quantity||
       !validCent(item.unit_price_cents))
      fail('unverified_quote_draft');
    seen.add(item.item_id);
    subtotal+=item.quantity*item.unit_price_cents;
    if(!Number.isSafeInteger(subtotal)||subtotal>MAX_TOTAL)
      fail('unverified_quote_draft');
    identity.push({item_id:item.item_id,quantity:item.quantity});
    units.push(immutable({
      id:item.item_id,quantity:item.quantity,
      unitPrice:asMoney(item.unit_price_cents),
    }));
  }
  const originalFingerprint=hash('jill_work_quote_source_v1\n'+
    JSON.stringify({
      shop:SHOP,submission_id:submissionId,
      source_revision:detail.revision,items:identity,
    }));
  const f=saved.fees_cents;
  const charges=subtotal+f.materials+f.labor+f.shipping+f.other;
  const total=charges-f.discount+f.tax;
  if(originalFingerprint!==row.source_sha256||
     subtotal!==saved.subtotal_cents||
     charges>MAX_TOTAL||f.discount>charges||
     !Number.isSafeInteger(total)||total!==saved.total_cents||
     total>MAX_TOTAL)
    fail('unverified_quote_draft');
  const fees=immutable(Object.fromEntries(
    FEES.map(k=>[k,asMoney(f[k])])));
  return immutable({
    state:'ready',submission_id:submissionId,
    draft_revision:row.draft_revision,
    source_revision:detail.revision,
    updated_at_ms:row.updated_at_ms,
    lines:immutable(units),fees,
    estimated_total_cents:total,currency:'USD',
    saved_in_real_work:false, // Local test data is not live evidence.
    customer_approved:false,invoice_sent:false,payment_confirmed:false,
  });
}

/** @param {{
  request?:Request,enabled?:boolean,
  authenticate?:{admin:(request:Request)=>Promise<{session:any}>},
  db?:any,readFreshList?:()=>Promise<any>,
  readExactDetail?:(x:{submissionId:string})=>Promise<any>
}} [options] */
export async function handleWorkQuoteDraftRead({
  request,enabled=false,authenticate,db,readFreshList,readExactDetail,
}={}){
  if(request?.method!=='GET')return result(405,'method_not_allowed');
  // Do not touch Shopify, D1 or customer source when hard OFF.
  if(enabled!==true)return result(503,'quote_drafts_not_enabled');
  if(typeof authenticate?.admin!=='function'||
     typeof db?.prepare!=='function'||
     typeof readFreshList!=='function'||
     typeof readExactDetail!=='function')
    return result(503,'quote_drafts_unavailable');
  let permission;
  try{
    const {session}=await authenticate.admin(request);
    permission=await readWorkMerchantPermission({
      db,session,action:'requests.read',
    });
  }catch{return result(403,'access_denied');}
  if(permission.allowed!==true||permission.role!=='owner')
    return result(permission.code==='authority_unavailable'?503:403,
      'access_denied');
  const url=new URL(request.url);
  const keys=[...url.searchParams.keys()];
  if(keys.length!==1||keys[0]!=='submission_id'||
     !ID.test(url.searchParams.get('submission_id')||'')||
     request.headers.get('origin') &&
       request.headers.get('origin')!==url.origin)
    return result(400,'invalid_quote_request');
  const id=url.searchParams.get('submission_id');
  let original;
  try{
    const list=projectWorkMerchantInbox(await readFreshList());
    original=list.records.find(x=>x.submission_id===id);
    if(!original)return result(404,'request_not_found');
    const detail=await readExactDetail({submissionId:id});
    if(detail?.submission_id!==id||
       detail.revision!==original.revision||
       detail.items?.length!==original.item_count)
      return result(409,'source_revision_changed');
    const row=await db.prepare(
      'SELECT shop,submission_id,draft_revision,source_revision,'+
      'source_sha256,quote_sha256,quote_json,total_cents,currency,'+
      'state,updated_at_ms FROM jill_work_quote_drafts '+
      'WHERE shop=? AND submission_id=?'
    ).bind(SHOP,id).first();
    if(row===null)return result(200,'no_saved_draft',{state:'none'});
    try{
      const draft=projectVerifiedWorkQuoteDraft({
        row,detail,submissionId:id,
      });
      return result(200,'draft_ready',{draft});
    }catch(error){
      if(error?.message==='stale_quote_draft_source')
        return result(409,'source_revision_changed');
      return result(503,'quote_draft_unverified');
    }
  }catch{return result(503,'quote_draft_source_unavailable');}
}
