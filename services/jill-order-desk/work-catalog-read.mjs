import {readWorkMerchantPermission} from './merchant-access.mjs';

export const WORK_CATALOG_QUERY=`query JillWorkCatalog($after: String) {
  products(first: 20, after: $after, sortKey: ID) {
    nodes {
      id title status handle
      variants(first: 10) {
        nodes { id title price inventoryPolicy }
        pageInfo { hasNextPage endCursor }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;
// No contacts, inventory counts, bulk export, catalog writes or copied D1 data.
/** @param {{request?:Request,authenticate?:any,db?:any,enabled?:boolean,now?:()=>number}} [options] */
export async function handleWorkCatalogRead({request,authenticate,db,enabled=false,now=Date.now}={}){
  const response=(status,data)=>Response.json(data,{status,
    headers:{'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff'}});
  if(request?.method!=='GET')return response(405,{state:'unavailable'});
  const {session,admin}=await authenticate.admin(request);
  const permission=await readWorkMerchantPermission({db,session,action:'catalog.read'});
  if(!permission.allowed||permission.role!=='owner')
    return response(403,{state:'access_denied'});
  if(!enabled)return response(200,{state:'not_connected'});
  const params=new URL(request.url).searchParams;
  const cursor=params.get('after');
  if(params.size>1||(params.size===1&&!params.has('after'))||
    (cursor!==null&&(!cursor||cursor.length>512||/[\s\x00-\x1f]/.test(cursor))))
    return response(400,{state:'invalid_request'});
  try{
    const result=await admin.graphql(WORK_CATALOG_QUERY,{variables:{after:cursor},
      signal:AbortSignal.timeout(10000)});
    const value=await result.json();
    if(!result.ok||value.errors?.length)throw Error();
    const products=value.data?.products;
    if(!Array.isArray(products?.nodes)||products.nodes.length>20||
      typeof products.pageInfo?.hasNextPage!=='boolean'||
      (products.pageInfo.hasNextPage&&typeof products.pageInfo.endCursor!=='string'))throw Error();
    const records=products.nodes.map(p=>{
      if(!/^gid:\/\/shopify\/Product\/[1-9][0-9]*$/.test(p.id)||
        typeof p.title!=='string'||!p.title||p.title.length>255||
        !['ACTIVE','DRAFT','ARCHIVED','UNLISTED'].includes(p.status)||
        !Array.isArray(p.variants?.nodes)||p.variants.nodes.length>10||
        typeof p.variants.pageInfo?.hasNextPage!=='boolean')throw Error();
      return {id:p.id,title:p.title,status:p.status,
        admin_url:'https://admin.shopify.com/store/jill-work/products/'+p.id.split('/').pop(),
        variants:p.variants.nodes.map(v=>{
          if(!/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(v.id)||
            typeof v.title!=='string'||v.title.length>255||
            !/^\d{1,9}\.\d{1,2}$/.test(v.price)||
            !['DENY','CONTINUE'].includes(v.inventoryPolicy))throw Error();
          return {id:v.id,title:v.title,price:v.price,inventory_policy:v.inventoryPolicy};
        }),variants_truncated:p.variants.pageInfo.hasNextPage};
    });
    if(new Set(records.map(p=>p.id)).size!==records.length)throw Error();
    return response(200,{state:'ready',as_of:new Date(now()).toISOString(),records,
      next_cursor:products.pageInfo.hasNextPage?products.pageInfo.endCursor:null,
      stock_state:'not_requested',currency_state:'shop_currency_not_yet_verified'});
  }catch{return response(503,{state:'source_unavailable'});}
}
