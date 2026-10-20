// Explicit, bounded merchant detail search. NOT invoked on keystrokes.
// Authorized Owner only, signed canonical Google QA reads, no PII persisted.
// POST hides customer search text from URL and WORK server timing logs.
import {createHash} from 'node:crypto';
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {projectWorkMerchantInbox} from './merchant-inbox-read.mjs';
import {DETAIL_SEARCH_PAGE_SIZE,validateWorkDetailSearch,
  validateWorkDetailSearchCursor,matchesVerifiedWorkDetail}
  from './work-request-detail-search.mjs';
const HEADERS={'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff'};
const respond=(status,code,extra={})=>Response.json({
  ok:status===200,code,...extra,
},{status,headers:HEADERS});
function fingerprint(records){
  return createHash('sha256').update(JSON.stringify(records.map(r=>[
    r.submission_id,r.revision,r.customer_status,
  ])),'utf8').digest('hex');
}
async function readInput(request) {
  if(request.headers.get('content-type')?.split(';')[0]?.toLowerCase()!==
     'application/x-www-form-urlencoded')throw Error('invalid_search_input');
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^[0-9]{1,4}$/.test(length)||Number(length)>1024))
    throw Error('invalid_search_input');
  const body=await request.text();
  if(body.length>1024)throw Error('invalid_search_input');
  const entries=new URLSearchParams(body),v={};
  for(const [k,value] of entries){
    if(!['q','cursor','snapshot','tag'].includes(k)||Object.hasOwn(v,k))
      throw Error('invalid_search_input');
    v[k]=value;
  }
  if(Object.keys(v).length!==4||
     !/^[0-9a-f]{64}$|^$/.test(v.snapshot||'')||
     !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/.test(v.tag||''))
    throw Error('invalid_search_input');
  return {q:validateWorkDetailSearch(v.q),cursor:v.cursor,
    snapshot:v.snapshot,tag:v.tag};
}
/** All three delegated reads are injectable for offline security tests. */
export async function handleWorkRequestDetailSearch({
  request,authenticate,db,enabled=false,readFreshList,
  readExactDetail,
}={}){
  if(request?.method!=='POST')return respond(405,'method_not_allowed');
  if(enabled!==true)return respond(503,'detail_search_not_enabled');
  if(typeof authenticate?.admin!=='function'||
     typeof db?.prepare!=='function'||
     typeof readFreshList!=='function'||
     typeof readExactDetail!=='function')
    return respond(503,'detail_search_unavailable');
  let grant;
  try{
    const {session}=await authenticate.admin(request);
    grant=await readWorkMerchantPermission({
      db,session,action:'requests.read',
    });
  }catch{return respond(403,'access_denied');}
  if(grant.allowed!==true||grant.role!=='owner')
    return respond(grant.code==='authority_unavailable'?503:403,
      'access_denied');
  if(request.headers.get('origin')!==new URL(request.url).origin)
    return respond(403,'invalid_origin');
  let input;
  try{input=await readInput(request);}
  catch{return respond(400,'invalid_search');}
  try{
    const signed=projectWorkMerchantInbox(await readFreshList());
    const records=signed.records;
    const cursor=validateWorkDetailSearchCursor(input.cursor,records.length);
    const current=fingerprint(records);
    if(cursor>0&&input.snapshot!==current)
      return respond(409,'source_changed');
    if(cursor===0&&input.snapshot!=='')
      return respond(400,'invalid_search');
    const page=records.slice(cursor,cursor+DETAIL_SEARCH_PAGE_SIZE);
    const matches=[];
    // At most TWO Google exact-ID detail reads are active at a time.
    // Every failure fails the entire page, never becomes a false "no match".
    for(let i=0;i<page.length;i+=2){
      const pair=page.slice(i,i+2);
      const details=await Promise.all(pair.map(row=>
        readExactDetail({submissionId:row.submission_id})));
      for(let j=0;j<pair.length;j++){
        const row=pair[j],detail=details[j];
        if(detail?.submission_id!==row.submission_id ||
           detail?.revision!==row.revision ||
           detail?.items?.length!==row.item_count)
          return respond(409,'source_changed');
        if(matchesVerifiedWorkDetail(detail,input.q))
          matches.push(row.submission_id);
      }
    }
    const next=cursor+page.length;
    return respond(200,'search_page',{
      matches,scanned:page.length,total:records.length,tag:input.tag,
      next_cursor:next<records.length?next:null,
      snapshot:current,
      // No names, emails, phones, addresses, terms, raw details or snippets.
    });
  }catch{return respond(503,'detail_search_unavailable');}
}
