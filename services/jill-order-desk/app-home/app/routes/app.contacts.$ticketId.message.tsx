// Source-only Shopify Owner command route, OFF by default.
import {type ActionFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce} from "../../../work-admin-auth-once.mjs";
import {persistWorkContactMerchantMessage}
 from "../../../work-contact-message-write.mjs";

export async function action({request,context,params}:ActionFunctionArgs){
 const env=context.cloudflare.env;
 return persistWorkContactMerchantMessage({
  request,expectedTicketId:params.ticketId,
  enabled:env.JILL_WORK_CONTACT_INBOX_ENABLED==="true"&&
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
