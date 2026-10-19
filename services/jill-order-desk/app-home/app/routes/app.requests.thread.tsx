import {type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {handleWorkRequestThread} from "../../../work-request-thread.mjs";

export async function loader({request,context}:LoaderFunctionArgs){
  const env=context.cloudflare.env;
  return handleWorkRequestThread({request,authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,secret:env.JILL_HQ_MERCHANT_READ_SECRET,
    enabled:env.JILL_WORK_CONVERSATION_ENABLED==="true"});
}
