import {readWorkMerchantPermission} from './merchant-access.mjs';

const SHOP='jill-work.myshopify.com';
const SHOP_QUERY='shop { myshopifyDomain currencyCode }';
export const WORK_CATALOG_QUERY=`query JillWorkCatalog($after: String) {
  ${SHOP_QUERY}
  products(first: 20, after: $after, sortKey: ID) {
    nodes {
      id title status
      variants(first: 10) {
        nodes { id title price inventoryPolicy }
        pageInfo { hasNextPage endCursor }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;
export const WORK_COLLECTIONS_QUERY=`query JillWorkCollections($after: String) {
  ${SHOP_QUERY}
  collections(first: 20, after: $after, sortKey: ID) {
    nodes { id title }
    pageInfo { hasNextPage endCursor }
  }
}`;
export const WORK_LOCATIONS_QUERY=`query JillWorkLocations($after: String) {
  ${SHOP_QUERY}
  locations(first: 20, after: $after, includeInactive: true) {
    nodes { id name isActive }
    pageInfo { hasNextPage endCursor }
  }
}`;
export const WORK_INVENTORY_QUERY=`query JillWorkInventory($after: String) {
  ${SHOP_QUERY}
  productVariants(first: 20, after: $after, sortKey: ID) {
    nodes {
      id title product { id title }
      inventoryItem {
        id tracked
        inventoryLevels(first: 5) {
          nodes { location { id name } quantities(names: ["available"]) { name quantity } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;
const views={products:{query:WORK_CATALOG_QUERY,action:'catalog.read',connection:'products'},
  collections:{query:WORK_COLLECTIONS_QUERY,action:'catalog.read',connection:'collections'},
  locations:{query:WORK_LOCATIONS_QUERY,action:'locations.read',connection:'locations'},
  inventory:{query:WORK_INVENTORY_QUERY,action:'inventory.read',connection:'productVariants'}};
function requireValue(valid){if(!valid)throw Error('catalog_source_invalid');}
function gid(value,type){requireValue(new RegExp('^gid://shopify/'+type+'/[1-9][0-9]*$').test(value));return value;}
function label(value){requireValue(typeof value==='string'&&value.length>0&&value.length<=255);return value;}
function connection(value,max){
  requireValue(Array.isArray(value?.nodes)&&value.nodes.length<=max&&
    typeof value.pageInfo?.hasNextPage==='boolean'&&
    (!value.pageInfo.hasNextPage||(typeof value.pageInfo.endCursor==='string'&&
      value.pageInfo.endCursor.length>0&&value.pageInfo.endCursor.length<=512)));
  return value;
}
function unique(records){requireValue(new Set(records.map(x=>x.id)).size===records.length);return records;}
const adminUrl=(kind,id)=>'https://admin.shopify.com/store/jill-work/'+kind+'/'+id.split('/').pop();
function productRecord(p){
  gid(p.id,'Product');label(p.title);
  requireValue(['ACTIVE','DRAFT','ARCHIVED','UNLISTED'].includes(p.status));
  const variants=connection(p.variants,10);
  return {id:p.id,title:p.title,status:p.status,admin_url:adminUrl('products',p.id),
    variants:unique(variants.nodes.map(v=>{
      gid(v.id,'ProductVariant');label(v.title);
      requireValue(/^\d{1,9}\.\d{1,2}$/.test(v.price)&&['DENY','CONTINUE'].includes(v.inventoryPolicy));
      return {id:v.id,title:v.title,price:v.price,inventory_policy:v.inventoryPolicy};
    })),variants_truncated:variants.pageInfo.hasNextPage};
}
function inventoryRecord(v){
  gid(v.id,'ProductVariant');label(v.title);gid(v.product?.id,'Product');label(v.product?.title);
  const item=v.inventoryItem;gid(item?.id,'InventoryItem');requireValue(typeof item.tracked==='boolean');
  const levels=connection(item.inventoryLevels,5);
  const locations=unique(levels.nodes.map(level=>{
    const location=level.location;gid(location?.id,'Location');label(location.name);
    requireValue(Array.isArray(level.quantities)&&level.quantities.length===1&&
      level.quantities[0].name==='available'&&Number.isSafeInteger(level.quantities[0].quantity));
    return {id:location.id,name:location.name,available:item.tracked?level.quantities[0].quantity:null};
  }));
  return {id:v.id,title:v.title,product_title:v.product.title,inventory_item_id:item.id,
    admin_url:adminUrl('products',v.product.id),tracked:item.tracked,
    stock_state:item.tracked?'tracked':'not_tracked',locations,
    locations_truncated:levels.pageInfo.hasNextPage};
}
// One bounded projection owner. No catalog persistence, contacts or mutations.
/** @param {{request?:Request,authenticate?:any,db?:any,enabled?:boolean,now?:()=>number}} [options] */
export async function handleWorkCatalogRead({request,authenticate,db,enabled=false,now=Date.now}={}){
  const response=(status,data)=>Response.json(data,{status,
    headers:{'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff'}});
  if(request?.method!=='GET')return response(405,{state:'unavailable'});
  const {session,admin}=await authenticate.admin(request);
  const params=new URL(request.url).searchParams;
  const view=params.get('view')||'products',cursor=params.get('after');
  if(!Object.hasOwn(views,view)||[...params.keys()].some(k=>!['after','view'].includes(k))||
    params.getAll('view').length>1||params.getAll('after').length>1||
    (cursor!==null&&(!cursor||cursor.length>512||/[\s\x00-\x1f]/.test(cursor))))
    return response(400,{state:'invalid_request'});
  const spec=views[view];
  const permission=await readWorkMerchantPermission({db,session,action:spec.action});
  if(!permission.allowed||permission.role!=='owner')return response(403,{state:'access_denied',view});
  if(!enabled)return response(200,{state:'not_connected',view});
  try{
    const result=await admin.graphql(spec.query,{variables:{after:cursor},signal:AbortSignal.timeout(10000)});
    const value=await result.json();
    requireValue(result.ok&&!value.errors?.length&&value.data?.shop?.myshopifyDomain===SHOP&&
      /^[A-Z]{3}$/.test(value.data.shop.currencyCode));
    const page=connection(value.data[spec.connection],20);
    const records=unique(page.nodes.map(p=>{
      if(view==='products')return productRecord(p);
      if(view==='inventory')return inventoryRecord(p);
      if(view==='collections')return {id:gid(p.id,'Collection'),title:label(p.title),
        admin_url:adminUrl('collections',p.id)};
      requireValue(typeof p.isActive==='boolean');
      return {id:gid(p.id,'Location'),title:label(p.name),active:p.isActive,
        admin_url:adminUrl('settings/locations',p.id)};
    }));
    return response(200,{state:'ready',view,as_of:new Date(now()).toISOString(),records,
      currency:value.data.shop.currencyCode,
      next_cursor:page.pageInfo.hasNextPage?page.pageInfo.endCursor:null,
      stock_state:view==='inventory'?'per_item':'not_requested',capacity_state:'not_measured'});
  }catch{return response(503,{state:'source_unavailable',view});}
}
