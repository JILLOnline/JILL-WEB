// Server-only App Home loader adapter for a Shopify SDK-authenticated React
// Router route. No public API, browser token verification, or staff mutation.
// The official authenticate.admin(request) runs FIRST even if D1 is missing.
import {loadJillOrderDeskHome} from '../admin-home.mjs';

export async function loadWorkShopifyAdminRoute({
  request,authenticate,env,
}={}) {
  const result=await loadJillOrderDeskHome({
    request,authenticate,db:env?.JILL_ORDER_DESK_WORK_DB,
  });
  return Response.json(result.model,{
    status:result.status,headers:result.headers,
  });
}
