// Source-only Shopify Owner command route, OFF by default.
import {type ActionFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce} from "../../../work-admin-auth-once.mjs";
import {persistWorkContactMerchantMessage}
 from "../../../work-contact-message-write.mjs";

export async function action({request,context,params}:ActionFunctionArgs){
 const env=context.cloudflare.env;
 // The ticket URL is not sufficient ownership or write authority; the
 // signed command body must name the same ticket as the pathname.
 let exact=false;
 try{
  const copy=request.clone();
  const data=await copy.json();
  exact=data?.ticket_id===params.ticketId;
 }catch{/* service will fail closed on malformed payload */}
 if(!exact)return Response.json({ok:false,code:"invalid_ticket"},{
  status:400,headers:{"cache-control":"no-store"}});
 return persistWorkContactMerchantMessage({
  request,enabled:env.JILL_WORK_CONTACT_INBOX_ENABLED==="true"&&
    env.JILL_WORK_CONTACT_MESSAGES_ENABLED==="true",
  db:env.JILL_ORDER_DESK_WORK_DB,
  authenticate:{admin:()=>authenticateWorkAdminOnce({
   scope:context.cloudflare,
   authenticate:()=>workShopify(env).authenticate.admin(request),
  })},
 });
}
export default function ContactMessageCommand(){
 return null;
}
