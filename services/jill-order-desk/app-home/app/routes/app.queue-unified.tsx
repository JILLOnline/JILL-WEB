// JILL HQ WORK — combined owner queue JSON route CANDIDATE.
// SOURCE ONLY: feature flag is absent in every released WORK manifest.
// This is not a customer endpoint, message writer, quote sender or export.
// The gateway, My JILL, Shopify theme and normal /app/queue are unchanged.
import {type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce}
 from "../../../work-admin-auth-once.mjs";
import {loadWorkMerchantInbox}
 from "../../../merchant-inbox-read.mjs";
import {readWorkGoogleQaMerchantList}
 from "../../../work-google-merchant-read.mjs";
import {readWorkContactTicketInbox}
 from "../../../work-contact-ticket-inbox.mjs";
import {readUnifiedWorkOwnerQueue}
 from "../../../work-unified-owner-queue.mjs";

const headers={
 "cache-control":"private, no-store, max-age=0",
 "x-content-type-options":"nosniff",
};

export async function loader({request,context}:LoaderFunctionArgs){
 const env=context.cloudflare.env;
 // Off before calling SDK, D1, Google or Contact. Worker ingress also
 // independently rejects this exact path before generic OAuth handling.
 if((env as typeof env & {JILL_WORK_UNIFIED_QUEUE_ENABLED?:string})
   .JILL_WORK_UNIFIED_QUEUE_ENABLED!=="true")
  return Response.json({state:"not_connected",records:[]},
   {status:503,headers});
 const admin=()=>authenticateWorkAdminOnce({
  scope:context.cloudflare,
  authenticate:()=>workShopify(env).authenticate.admin(request),
 });
 const data=await readUnifiedWorkOwnerQueue({
  enabled:true,
  contactEnabled:(env as typeof env & {
   JILL_WORK_CONTACT_INBOX_ENABLED?:string
  }).JILL_WORK_CONTACT_INBOX_ENABLED==="true",
  request,
  readRequests:()=>loadWorkMerchantInbox({
   request,authenticate:{admin},db:env.JILL_ORDER_DESK_WORK_DB,
   readCanonicalSource:typeof env.JILL_HQ_MERCHANT_READ_SECRET==="string"&&
    env.JILL_HQ_MERCHANT_READ_SECRET.length>=32
    ?()=>readWorkGoogleQaMerchantList({
       secret:env.JILL_HQ_MERCHANT_READ_SECRET,
     })
    :undefined,
  }),
  readContacts:()=>readWorkContactTicketInbox({
   request,enabled:true,authenticate:{admin},
   db:env.JILL_ORDER_DESK_WORK_DB,
  }),
 });
 // Partial != zero contact tickets. Never set success for a failed
 // identity check, incomplete feed or source outage.
 return Response.json(data,{
  status:data.state==="ready"||data.state==="partial"?200:503,
  headers,
 });
}
