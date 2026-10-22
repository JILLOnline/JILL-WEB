// Pure, read-only WORK My JILL customer-account messaging release contract.
// Validates source wiring ONLY. A Shopify network_access declaration is not
// proof that Shopify published/approved the extension or that Google is ready.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {WORK_CUSTOM_ORDER_ACCOUNT_URL}
 from '../shared/customer-custom-orders.mjs';
const ROOT='extensions/jill-account-dashboard/';
const EXPECTED='https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev/jill-custom-order-account';
const safe=(source,pattern)=>typeof source==='string'&&pattern.test(source);
function assert(condition,code){if(!condition)throw Error('STOP my_jill_message_'+code);}
export function inspectWorkMyJillMessagingSource({
 extension,customerReader,worker,reply,hub,orders,messages,
 endpoint=WORK_CUSTOM_ORDER_ACCOUNT_URL,
}={}){
 for(const field of [extension,customerReader,worker,reply,hub,orders,messages])
  assert(typeof field==='string'&&field.length>0,'missing_source');
 const single=(value,key,expected)=>{
  const r=new RegExp('^\\s*'+key+'\\s*=\\s*'+expected+'\\s*$','gm');
  assert((value.match(r)||[]).length===1,'capability_'+key);
 };
 assert(endpoint===EXPECTED,'wrong_work_gateway');
 assert(!/jillonlinestore\.com|jqtdgr-1y\.myshopify\.com|ebf1a69d82f46619d2f2945faab78afa/i.test(
  [extension,customerReader,worker,reply,hub,orders,messages].join('\n')),'live_reference');
 assert(safe(extension,/type\s*=\s*"ui_extension"/),'extension_type');
 assert(safe(extension,/handle\s*=\s*"jill-account-dashboard"/),'extension_handle');
 assert(safe(extension,/target\s*=\s*"customer-account\.page\.render"/),'page_render');
 assert(safe(extension,/module\s*=\s*"\.\/src\/Dashboard\.jsx"/),'module_path');
 single(extension,'api_access','true');
 single(extension,'network_access','true');
 assert(safe(customerReader,/jill-work-custom-orders-qa\.jill-work-custom-orders\.workers\.dev\/jill-custom-order-account/),'reader_host');
 assert(safe(customerReader,/new URL\('\/jill-custom-order-reply',WORK_CUSTOM_ORDER_ACCOUNT_URL\)/),'reply_same_gateway');
 assert(safe(customerReader,/Authorization:'Bearer '\+jwt/),'shopify_customer_jwt');
 assert(safe(customerReader,/sessionToken\.get\(\)/),'session_verification');
 assert(safe(worker,/pathname==='\/jill-custom-order-reply'/),'worker_reply_route');
 assert(safe(worker,/enabled:env\.JILL_WORK_CONVERSATION_ENABLED==='true'/),'worker_write_flag');
 assert(safe(reply,/if\(enabled!==true\)return failure\(503,'conversation_not_connected'\)/),'writer_fail_closed');
 assert(safe(reply,/verifyWorkCustomerAccountSession/),'writer_customer_signature');
 assert(safe(orders,/loadWorkCustomerCustomOrders\(\{sessionToken\}\)/),'orders_signed_reader');
 assert(safe(messages,/loadWorkCustomerCustomOrders\(\{sessionToken\}\)/),'messages_signed_reader');
 assert(safe(hub,/messages: <Messages requestedSubmissionId=\{messageRequestTarget\}/),'internal_handoff');
 assert(safe(messages,/selectOwnedMessageRequest\(list/),'customer_owned_selection');
 assert(safe(messages,/retainOwnedMessageDrafts\(previous,orders\)/),'customer_owned_drafts');
 assert(!/localStorage|sessionStorage|document\.cookie/.test(hub+orders+messages),
  'persistent_customer_drafts');
 return Object.freeze({
  status:'WORK_MY_JILL_MESSAGING_SOURCE_WIRED',
  account_extension:'jill-account-dashboard',
  customer_endpoint:EXPECTED,
  source_network_access_declared:true,
  signed_customer_list_wired:true,
  fail_closed_write_flag_wired:true,
  source_only:true,
  remote_work_gateway_verified:false,
  deployed_customer_extension_verified:false,
  live_customer_A_B_verified:false,
  google_qa_published_source_verified:false,
  sending_authorized:false,
  shopify_publish_authorized:false,
 });
}
export function auditWorkMyJillMessagingSource(){
 const read=p=>readFileSync(p,'utf8');
 return inspectWorkMyJillMessagingSource({
  extension:read(ROOT+'shopify.extension.toml'),
  customerReader:read('shared/customer-custom-orders.mjs'),
  worker:read('services/custom-order-cloudflare/handler.mjs'),
  reply:read('backend/custom-order-conversation.mjs'),
  hub:read(ROOT+'src/hub/AccountHub.jsx'),
  orders:read(ROOT+'src/pages/CustomOrders.jsx'),
  messages:read(ROOT+'src/pages/Messages.jsx'),
 });
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==2){console.error('STOP source audit takes no flags');process.exitCode=1;}
 else{
  try{console.log(JSON.stringify(auditWorkMyJillMessagingSource(),null,2));}
  catch(e){console.error(e.message);process.exitCode=1;}
 }
}
