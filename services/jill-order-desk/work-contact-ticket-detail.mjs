// WORK HQ private Contact Us detail reader — SOURCE ONLY / hard OFF.
// The D1 row is private and is NEVER returned to My JILL or a storefront.
// Exact Owner/D1 permission comes BEFORE any contact data lookup.
import {createHash} from 'node:crypto';
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {projectVerifiedContactThread} from '../../backend/work-contact-thread-read.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const REASON=new Set(['existing','shipping','product','custom',
 'pickup','business','website','other']);
const STATUS=new Set(['received','reviewing','waiting_customer','resolved']);
const HEADERS={'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff'};
const result=(status,code,more={})=>Response.json({
 ok:status===200,code,...more,
},{status,headers:HEADERS});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=()=>{throw Error('contact_detail_unverified');};
const hash=json=>createHash('sha256').update(
 'jill_work_contact_ticket_v1\n'+json,'utf8').digest('hex');
export function projectVerifiedWorkContactDetail({row,ticketId}={}){
 if(!ID.test(ticketId||'')||!obj(row)||row.shop!==SHOP||
    row.ticket_id!==ticketId||
    row.source!=='shopify_contact_bridge'||
    !/^[a-f0-9]{64}$/.test(row.body_sha256||'')||
    typeof row.contact_json!=='string'||row.contact_json.length>8192||
    !STATUS.has(row.state)||!Number.isSafeInteger(row.revision)||
    row.revision<1||row.revision>100||
    !Number.isSafeInteger(row.created_at_ms)||row.created_at_ms<=0||
    !Number.isSafeInteger(row.updated_at_ms)||
    row.updated_at_ms<row.created_at_ms||
    !(row.owner_customer_gid===null||GID.test(row.owner_customer_gid||''))||
    hash(row.contact_json)!==row.body_sha256)fail();
 let contact;
 try{contact=JSON.parse(row.contact_json);}catch{fail();}
 if(!obj(contact)||contact.ticket_id!==ticketId||
    !REASON.has(contact.reason)||contact.reviewed!==true||
    typeof contact.name!=='string'||contact.name.length<1||
    contact.name.length>120||
    typeof contact.email!=='string'||contact.email.length>254||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)||
    typeof contact.phone!=='string'||contact.phone.length>40||
    !['Email','Phone'].includes(contact.preferred_contact)||
    typeof contact.message!=='string'||contact.message.length<1||
    contact.message.length>3000||!obj(contact.details))fail();
 const details={};
 const keys=['order_number','product_name','business_name',
  'business_link','website_area','device','reference_images'];
 if(Object.keys(contact.details).length!==keys.length)fail();
 for(const key of keys){
  const v=contact.details[key];
  if(typeof v!=='string'||v.length>200)fail();
  details[key]=v;
 }
 if(!['','Yes','No'].includes(details.reference_images))fail();
 return Object.freeze({
  kind:'contact',ticket_id:ticketId,reason:contact.reason,
  status:row.state,revision:row.revision,
  created_at_ms:row.created_at_ms,updated_at_ms:row.updated_at_ms,
  // ONLY for Owner-authorized HQ details, not a public ticket projection.
  name:contact.name,email:contact.email,phone:contact.phone,
  preferred_contact:contact.preferred_contact,message:contact.message,
  details:Object.freeze(details),
  owner_customer_verified:GID.test(row.owner_customer_gid||''),
  customer_reply_enabled:false,
  can_invoice:false,can_create_order:false,
 });
}
// Owner-only, public-message subset from signed Customer A's immutable
// reply ledger. Never reveal Customer GID, JWT, operation or payload hash.
export function projectVerifiedOwnerContactReplies({
 rows,claimedCustomerGid,
}={}){
 if(!GID.test(claimedCustomerGid||'')||
    !Array.isArray(rows)||rows.length>50)
  fail();
 let sequence=0,lastTime=0;
 return Object.freeze(rows.map(r=>{
  if(!obj(r)||r.reply_sequence!==sequence+1||
   r.actor_customer_gid!==claimedCustomerGid||
   typeof r.body_text!=='string'||r.body_text.length<1||
   r.body_text.length>500||r.body_text!==r.body_text.trim()||
   [...r.body_text].some(ch=>{const n=ch.codePointAt(0);return n===127||
    (n<32&&n!==9&&n!==10&&n!==13);})||
   !Number.isSafeInteger(r.created_at_ms)||
   r.created_at_ms<1600000000000||
   r.created_at_ms<lastTime)fail();
  sequence=r.reply_sequence;lastTime=r.created_at_ms;
  return Object.freeze({sequence,author:'customer',message:r.body_text,
   created_at:new Date(r.created_at_ms).toISOString()});
 }));
}

/** @param {{
 * request?:Request,ticketId?:string,enabled?:boolean,
 * authenticate?:{admin:(request:Request)=>Promise<any>},
 * db?:any,authorize?:typeof readWorkMerchantPermission,
 * statusControlsEnabled?:boolean,messageControlsEnabled?:boolean,
 * customerRepliesEnabled?:boolean
 * }} [options]
 */
export async function readWorkContactTicketDetail({
 request,ticketId,enabled=false,authenticate,db,
 statusControlsEnabled=false,messageControlsEnabled=false,
 customerRepliesEnabled=false,authorize=readWorkMerchantPermission,
}={}){
 if(enabled!==true)return result(503,'not_connected');
 if(request?.method!=='GET')return result(405,'method_not_allowed');
 if(!ID.test(ticketId||''))return result(400,'invalid_ticket');
 if(typeof authenticate?.admin!=='function'||typeof authorize!=='function'||
    typeof db?.prepare!=='function')return result(503,'source_unavailable');
 let access;
 try{
  const sdk=await authenticate.admin(request);
  access=await authorize({db,session:sdk.session,action:'requests.read'});
 }catch{return result(403,'access_denied');}
 if(access?.allowed!==true||access.role!=='owner')
  return result(403,'access_denied');
 try{
  const row=await db.prepare(
   'SELECT shop,ticket_id,source,body_sha256,contact_json,state,revision,'+
   'created_at_ms,updated_at_ms,owner_customer_gid '+
   'FROM jill_work_contact_tickets WHERE shop=? AND ticket_id=?'
  ).bind(SHOP,ticketId).first();
  if(row===null)return result(404,'not_found');
  const detail=projectVerifiedWorkContactDetail({row,ticketId});
  let messages=[];
  // The private Owner view may show public messages only for a ticket
  // already claimed into an exact Shopify Customer Account.
  if(messageControlsEnabled===true&&GID.test(row.owner_customer_gid||'')){
   const collection=await db.prepare(
    'SELECT sequence,body_text,created_at_ms '+
    'FROM jill_work_contact_messages WHERE shop=? AND ticket_id=? '+
    'ORDER BY sequence ASC LIMIT 51'
   ).bind(SHOP,ticketId).all();
   if(!Array.isArray(collection?.results)||collection.results.length>50)
    return result(503,'message_source_unverified');
   messages=projectVerifiedContactThread({
    ticket:row,messages:collection.results,expectedId:ticketId,
    customerGid:row.owner_customer_gid,
   }).messages;
  }
  let customerReplies=[];
  if(messageControlsEnabled===true&&customerRepliesEnabled===true&&
     GID.test(row.owner_customer_gid||'')){
   const replies=await db.prepare(
    'SELECT reply_sequence,actor_customer_gid,body_text,created_at_ms '+
    'FROM jill_work_contact_customer_replies WHERE shop=? AND ticket_id=? '+
    'ORDER BY reply_sequence ASC LIMIT 51'
   ).bind(SHOP,ticketId).all();
   customerReplies=projectVerifiedOwnerContactReplies({
    rows:replies?.results,claimedCustomerGid:row.owner_customer_gid,
   });
  }
  return result(200,'ready',{detail,messages,customerReplies,
   can_change_status:statusControlsEnabled===true,
   can_post_message:messageControlsEnabled===true&&
      GID.test(row.owner_customer_gid||'')});
 }catch{return result(503,'source_unavailable');}
}
