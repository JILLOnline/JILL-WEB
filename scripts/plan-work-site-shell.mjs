#!/usr/bin/env node
// READ-ONLY Shopify site-shell parity, independent of My JILL Accounts.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const sitePages=new Set(['about-us','our-story','welcome','contact','data-sharing-opt-out','custom-order','coupons']);
function assert(ok,msg){if(!ok)throw Error('Site shell blocked: '+msg);}
function map(items,subject){
 assert(Array.isArray(items),subject+' missing');const out=new Map();
 for(const v of items){assert(typeof v.handle==='string',subject+' handle missing');
  assert(!out.has(v.handle),subject+' duplicate '+v.handle);out.set(v.handle,v);}
 return out;
}
function normalize(url){
 if(url==='https://jillonlinestore.com/pages/quote'||url==='/pages/quote'||url==='/pages/quote?view=custom-order')
  return '/pages/custom-order';
 if(typeof url!=='string')return '';
 if(url.startsWith('/'))return url;
 try{const u=new URL(url);
   return ['jillonlinestore.com','jqtdgr-1y.myshopify.com'].includes(u.hostname)
    ?u.pathname+u.search: 'EXTERNAL_REVIEW';
 }catch{return 'INVALID_REVIEW';}
}
export function planSiteShell(source,work){
 assert(source?.schema==='jill.site-shell-safe.v1'&&source.shop==='jillonlinestore.com',
   'incorrect LIVE source');
 assert(work?.schema==='jill.site-shell-safe.v1'&&work.shop==='jill-work.myshopify.com',
   'incorrect WORK destination');
 assert(source.customerAccountMenuExcluded===true&&work.customerAccountMenuExcluded===true,
   'account menu must not be transferred');
 const a=map(source.pages,'LIVE pages'),b=map(work.pages,'WORK pages');
 const pages=[];
 for(const [handle,p] of a){
  if(handle==='quote'){
   assert(b.has('custom-order'),'WORK QA custom-order page missing');
   pages.push({handle,action:'MAP_EXISTING_CUSTOM_ORDER',destinationHandle:'custom-order'});
  }else if(handle==='data-sharing-opt-out'){
   pages.push({handle,action:'SHOPIFY_MANAGED_KEEP'});
  }else if(handle==='coupons'){
   pages.push({handle,action:'REVIEW_ACCOUNTS_BOUNDARY'});
  }else if(!sitePages.has(handle)){
   pages.push({handle,action:'REVIEW_UNKNOWN_PAGE'});
  }else if(!b.has(handle)){
   pages.push({handle,action:'CREATE_UNPUBLISHED'});
  }else{
   const t=b.get(handle);
   pages.push({handle,action:p.body===t.body&&p.templateSuffix===t.templateSuffix
     ?'MATCH':'REVIEW_CONTENT_OR_TEMPLATE'});
  }
 }
 const sourceMenus=map(source.menus,'LIVE menus'),workMenus=map(work.menus,'WORK menus');
 assert([...sourceMenus.keys()].every(h=>['main-menu','footer'].includes(h)),
   'account or unknown LIVE menu present');
 const menus=[];
 for(const [handle,m] of sourceMenus){
  const desired=m.items.map(item=>({title:item.title,url:normalize(item.url)}));
  const actual=(workMenus.get(handle)?.items||[]).map(item=>({title:item.title,url:normalize(item.url)}));
  const external=desired.some(i=>i.url==='EXTERNAL_REVIEW'||i.url==='INVALID_REVIEW');
  menus.push({handle,action:external?'REVIEW_EXTERNAL_URL':JSON.stringify(desired)===JSON.stringify(actual)
    ?'MATCH':'REVIEW_MENU_UPDATE',desired});
 }
 return {schema:'jill.site-shell-plan.v1',dryRun:true,noWrites:true,
  sourceShop:source.shop,destinationShop:work.shop,
  summary:{createPages:pages.filter(p=>p.action==='CREATE_UNPUBLISHED').length,
    reviewPages:pages.filter(p=>p.action.startsWith('REVIEW')).length,
    reviewMenus:menus.filter(m=>m.action!=='MATCH').length},
  pages,menus,
  safety:'Never copy LIVE customer-account menu or publish WORK pages automatically.'};
}
const called=fileURLToPath(import.meta.url)===path.resolve(process.argv[1]||'');
if(called){
 const [a,b]=process.argv.slice(2);
 if(!a||!b){console.error('Usage: node scripts/plan-work-site-shell.mjs <live.site-shell.json> <work.site-shell.json>');process.exit(2);}
 try{console.log(JSON.stringify(planSiteShell(JSON.parse(fs.readFileSync(a,'utf8')),
   JSON.parse(fs.readFileSync(b,'utf8'))),null,2));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
