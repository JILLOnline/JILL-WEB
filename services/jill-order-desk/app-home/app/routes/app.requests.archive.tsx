// Owner-only WORK soft archive, normally OFF until distinct D1 migration
// and explicit release. Never calls Google or Shopify deletions.
import {type ActionFunctionArgs,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {handleWorkArchiveRead,handleWorkArchiveWrite}
  from "../../../work-request-archive-store.mjs";
import {readWorkGoogleQaMerchantList}
  from "../../../work-google-merchant-read.mjs";

function archiveEnabled(env:{
  JILL_WORK_HOST_STAGE?:string;JILL_WORK_HQ_ARCHIVE_ENABLED?:string;
}) {
  return env.JILL_WORK_HOST_STAGE==="canary" &&
    env.JILL_WORK_HQ_ARCHIVE_ENABLED==="true";
}
export async function loader({request,context}:LoaderFunctionArgs){
  const env=context.cloudflare.env as typeof context.cloudflare.env & {
    JILL_WORK_HQ_ARCHIVE_ENABLED?:string;
  };
  return handleWorkArchiveRead({
    request,enabled:archiveEnabled(env),
    authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,
  });
}
export async function action({request,context}:ActionFunctionArgs){
  const env=context.cloudflare.env as typeof context.cloudflare.env & {
    JILL_WORK_HQ_ARCHIVE_ENABLED?:string;
  };
  return handleWorkArchiveWrite({
    request,enabled:archiveEnabled(env),
    authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,
    readFreshList:()=>readWorkGoogleQaMerchantList({
      secret:env.JILL_HQ_MERCHANT_READ_SECRET,
    }),
  });
}
