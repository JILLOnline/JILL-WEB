// WORK-only D1 soft archive. Canonical Google intake is NEVER modified.
// Feature gate and remote migration remain OFF until separately approved.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {projectWorkMerchantInbox} from './merchant-inbox-read.mjs';
const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const OP=/^jill:work:archive:(?:remove|restore):[0-9a-f]{8}-[0-9a-f-]{27,36}$/;
const HEADER={'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff'};
const respond=(status,code,extra={})=>Response.json({ok:status===200,code,...extra},
  {status,headers:HEADER});
async function authorize({request,authenticate,db,action}){
  const {session}=await authenticate.admin(request);
  const grant=await readWorkMerchantPermission({db,session,action});
  if(grant.allowed!==true||grant.role!=='owner')
    throw Error('access_denied');
  return grant;
}
/** @param {{db?:any}} [options] */
export async function readWorkRemovedRequestIds({db}={}){
  if(typeof db?.prepare!=='function')throw Error('archive_database_unavailable');
  const result=await db.prepare('SELECT submission_id FROM jill_work_request_archive '+
    'WHERE shop=? AND is_removed=1 LIMIT 51').bind(SHOP).all();
  if(!result?.success||!Array.isArray(result.results)||result.results.length>50||
     result.results.some(row=>!ID.test(row?.submission_id||'')))
    throw Error('unverified_archive_rows');
  return result.results.map(row=>row.submission_id);
}
/** @param {{request?:Request,enabled?:boolean,
 * authenticate?:{admin:(request:Request)=>Promise<{session:any}>},
 * db?:any}} [options] */
export async function handleWorkArchiveRead({request,enabled=false,
  authenticate,db}={}){
  if(request?.method!=='GET')return respond(405,'method_not_allowed');
  if(enabled!==true)return respond(200,'archive_not_enabled',
    {enabled:false,removed_ids:[]});
  if(typeof authenticate?.admin!=='function'||typeof db?.prepare!=='function')
    return respond(503,'archive_unavailable');
  try{
    await authorize({request,authenticate,db,action:'requests.read'});
    const ids=await readWorkRemovedRequestIds({db});
    return respond(200,'archive_ready',{enabled:true,removed_ids:ids});
  }catch{return respond(503,'archive_unavailable');}
}
async function parseBody(request){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')
    throw Error('invalid_body');
  const size=request.headers.get('content-length');
  if(size!==null&&(!/^[0-9]{1,4}$/.test(size)||Number(size)>1024))
    throw Error('invalid_body');
  const text=await request.text();
  if(text.length>1024)throw Error('invalid_body');
  const pairs=new URLSearchParams(text),v={};
  for(const [k,x] of pairs){
    if(!['submission_id','source_revision','operation_id','action'].includes(k)||
       Object.hasOwn(v,k))throw Error('invalid_body');
    v[k]=x;
  }
  if(Object.keys(v).length!==4||!ID.test(v.submission_id||'')||
     !/^[1-9][0-9]{0,2}$/.test(v.source_revision||'')||
     Number(v.source_revision)>100||
     !['remove','restore'].includes(v.action)||
     !OP.test(v.operation_id||'')||
     !v.operation_id.startsWith('jill:work:archive:'+v.action+':'))
    throw Error('invalid_body');
  return {...v,source_revision:Number(v.source_revision)};
}
async function receipt(db,id){
  return db.prepare('SELECT submission_id,action,source_revision FROM '+
    'jill_work_request_archive_operations WHERE shop=? AND operation_id=?')
    .bind(SHOP,id).first();
}
async function current(db,id){
  return db.prepare('SELECT is_removed,last_operation_id FROM '+
    'jill_work_request_archive WHERE shop=? AND submission_id=?')
    .bind(SHOP,id).first();
}
function same(rec,input) {
  return rec?.submission_id===input.submission_id&&rec?.action===input.action&&
    rec?.source_revision===input.source_revision;
}
/** @param {{request?:Request,enabled?:boolean,
 * authenticate?:{admin:(request:Request)=>Promise<{session:any}>},
 * db?:any,readFreshList?:()=>Promise<any>,
 * now?:()=>number}} [options] */
export async function handleWorkArchiveWrite({request,enabled=false,
  authenticate,db,readFreshList,now=Date.now}={}){
  if(request?.method!=='POST')return respond(405,'method_not_allowed');
  if(enabled!==true)return respond(503,'archive_not_enabled');
  if(typeof authenticate?.admin!=='function'||
     typeof db?.batch!=='function'||typeof db?.prepare!=='function'||
     typeof readFreshList!=='function')return respond(503,'archive_unavailable');
  let grant;
  try{grant=await authorize({request,authenticate,db,action:'requests.write'});}
  catch{return respond(403,'access_denied');}
  if(request.headers.get('origin')!==new URL(request.url).origin)
    return respond(403,'invalid_origin');
  let input;
  try{input=await parseBody(request);}
  catch{return respond(400,'invalid_archive_command');}
  const desired=input.action==='remove'?1:0;
  try{
    const verified=projectWorkMerchantInbox(await readFreshList());
    if(!verified.records.some(r=>r.submission_id===input.submission_id&&
       r.revision===input.source_revision))
      return respond(409,'source_changed');
  }catch{return respond(503,'source_unavailable');}
  try{
    const prior=await receipt(db,input.operation_id);
    if(prior){
      const row=await current(db,input.submission_id);
      return same(prior,input)&&row?.last_operation_id===input.operation_id&&
        row.is_removed===desired
        ?respond(200,'archive_updated',{duplicate:true})
        :respond(409,'operation_conflict');
    }
    const at=now();
    if(!Number.isSafeInteger(at)||at<1600000000000)
      return respond(503,'archive_unavailable');
    const q1=db.prepare('INSERT INTO jill_work_request_archive '+
      '(shop,submission_id,is_removed,revision,last_operation_id,'+
      'updated_by_staff_id,updated_at_ms) VALUES (?,?,?,?,?,?,?) '+
      'ON CONFLICT(shop,submission_id) DO UPDATE SET '+
      'is_removed=excluded.is_removed,revision=excluded.revision,'+
      'last_operation_id=excluded.last_operation_id,'+
      'updated_by_staff_id=excluded.updated_by_staff_id,'+
      'updated_at_ms=excluded.updated_at_ms').bind(
        SHOP,input.submission_id,desired,input.source_revision,
        input.operation_id,String(grant.staffId),at);
    const q2=db.prepare('INSERT INTO jill_work_request_archive_operations '+
      '(shop,operation_id,submission_id,action,source_revision,'+
      'actor_staff_id,committed_at_ms) VALUES (?,?,?,?,?,?,?)').bind(
        SHOP,input.operation_id,input.submission_id,input.action,
        input.source_revision,String(grant.staffId),at);
    await db.batch([q1,q2]);
    const [saved,state]=await Promise.all([
      receipt(db,input.operation_id),current(db,input.submission_id)]);
    return same(saved,input)&&state?.is_removed===desired&&
      state.last_operation_id===input.operation_id
      ?respond(200,'archive_updated',{duplicate:false})
      :respond(503,'commit_unconfirmed');
  }catch{
    // D1 may have committed. Never claim failure or suggest regenerating ID.
    return respond(503,'commit_unconfirmed');
  }
}
