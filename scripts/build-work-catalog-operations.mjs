#!/usr/bin/env node
// Build a private, deterministic WORK-only import plan. NEVER calls Shopify.
// IDs/references are resolved in WORK after profile/product creation.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JILL_CATALOG_CAPABILITIES} from '../merchant/jill-catalog-capabilities.mjs';
import {planCatalogParity} from './plan-work-catalog-parity.mjs';
function guard(ok,msg){if(!ok)throw Error('WORK import blocked: '+msg);}
function stable(v){
 if(Array.isArray(v))return v.map(stable);
 if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
 return v;
}
export function buildWorkCatalogOperations(source,work){
 const parity=planCatalogParity(source,work);
 guard(!parity.summary.conflictingProducts&&!parity.summary.reviewProducts&&
   !parity.summary.conflictingProfiles,'Unresolved destination conflicts');
 guard(parity.collections.every(x=>!['CONFLICT_RULES','REVIEW_MEMBERSHIP'].includes(x.action)),
   'Collection rules or membership require reconciliation');
 const registry=new Map(JILL_CATALOG_CAPABILITIES.map(x=>[x.handle,x]));
 const products=new Map(source.products.map(p=>[p.handle,p]));
 const operations=[];
 if(parity.summary.profileDefinitionAction==='CREATE_IN_WORK'){
  operations.push({stage:'01_PROFILES',kind:'metaobject.definition.create',
   type:source.profileDefinition.type,fields:source.profileDefinition.fields});
 }
 for(const profile of parity.profiles.filter(x=>x.action==='CREATE_IN_WORK')){
  const p=source.personalizationProfiles.find(x=>x.handle===profile.handle);
  operations.push({stage:'01_PROFILES',kind:'metaobject.create',
   type:p.type,handle:p.handle,fields:p.fields});
 }
 for(const action of parity.products.filter(x=>x.action==='CREATE_DRAFT')){
  const p=products.get(action.handle),canonical=registry.get(action.handle);
  guard(p.jillCapabilityProfileId===canonical.profile.id,
    'LIVE capability id differs: '+p.handle);
  if(p.jillCapabilityProfile)guard(
    JSON.stringify(stable(p.jillCapabilityProfile))===JSON.stringify(stable(canonical.profile)),
    'LIVE capability definition differs: '+p.handle);
  guard(Array.isArray(p.variants)&&p.variants.length,'No variants: '+p.handle);
  const files=(p.images||[]).map(m=>{
   const u=new URL(m.url);
   guard(u.protocol==='https:'&&u.hostname==='cdn.shopify.com',
     'Unexpected image host: '+p.handle);
   return {contentType:'IMAGE',originalSource:m.url,alt:m.alt||''};
  });
  const sourceOptions=p.options||[];
  const defaultOnly=sourceOptions.length===1&&sourceOptions[0].name==='Title'&&
    JSON.stringify(sourceOptions[0].values)==='["Default Title"]'&&p.variants.length===1;
  guard(defaultOnly||sourceOptions.every(o=>o.name!=='Title'),
    'Unexpected default/explicit option mix: '+p.handle);
  const variants=p.variants.map(v=>{
   guard(Array.isArray(v.selectedOptions),'Missing option definitions for '+p.handle);
   const optionValues=v.selectedOptions.map(o=>({optionName:o.name,name:o.value}));
   guard(defaultOnly||optionValues.length===sourceOptions.length,
     'Variant missing selected options: '+p.handle+'/'+v.title);
   return {price:String(v.price),compareAtPrice:v.compareAtPrice??undefined,
     sku:v.sku??undefined,taxable:v.taxable??undefined,
     inventoryPolicy:v.inventoryPolicy??undefined,optionValues};
  });
  const metafields=[{namespace:'custom',key:'jill_product_capabilities',type:'json',
    value:JSON.stringify(canonical.profile)}];
  if(p.capabilityOverride)metafields.push({namespace:'custom',
    key:'jill_product_page_capability_override',type:'json',
    value:JSON.stringify(p.capabilityOverride)});
  if(p.customOrderExcluded)metafields.push({namespace:'custom',
    key:'jill_custom_order_excluded',type:'boolean',value:'true'});
  if(p.customOrderLabel)metafields.push({namespace:'custom',
    key:'jill_custom_order_label',type:'single_line_text_field',value:p.customOrderLabel});
  operations.push({stage:'02_PRODUCTS',kind:'product.draft.create',handle:p.handle,
   input:{title:p.title,handle:p.handle,status:'DRAFT',vendor:p.vendor,productType:p.productType,
    descriptionHtml:p.descriptionHtml,tags:p.tags,files,
    productOptions:sourceOptions.map((o,i)=>({name:o.name,position:i+1,
      values:o.values.map(value=>({name:value}))})),
    variants,metafields}});
  if(p.personalizationProfileHandle){
   operations.push({stage:'03_ATTACH_PROFILES',kind:'product.profile.attach',
     productHandle:p.handle,profileHandle:p.personalizationProfileHandle,
     destinationIds:'RESOLVE_AT_EXECUTION'});
  }
 }
 for(const action of parity.collections.filter(x=>x.action==='CREATE_UNPUBLISHED')){
  const c=source.collections.find(x=>x.handle===action.handle);
  operations.push({stage:'04_COLLECTIONS',kind:'collection.create_unpublished',
   handle:c.handle,title:c.title,descriptionHtml:c.descriptionHtml,sortOrder:c.sortOrder,
   ruleSet:c.ruleSet||null,productHandles:c.ruleSet?[]:c.productHandles,
   destinationIds:'RESOLVE_AT_EXECUTION'});
 }
 return {schema:'jill.work-import-operations.v1',target:'jill-work.myshopify.com',
   dryRun:true,mutationsExecuted:0,operations,
   preconditions:['Exact JILL WORK shop identity verified',
    'New products MUST be DRAFT; collections not published',
    'Create/reuse six personalization profiles before assigning references',
    'Do not update, delete or publish the 17 unrelated sample products',
    'Stop on any source drift, destination conflict, or failed operation']};
}
const called=fileURLToPath(import.meta.url)===path.resolve(process.argv[1]||'');
if(called){
 const [sourcePath,workPath]=process.argv.slice(2);
 if(!sourcePath||!workPath){console.error('Usage: node scripts/build-work-catalog-operations.mjs <live.safe.json> <work.safe.json>');process.exit(2);}
 try{
  const a=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
  const b=JSON.parse(fs.readFileSync(workPath,'utf8'));
  const result=buildWorkCatalogOperations(a,b);
  const dir=path.join(process.cwd(),'.work-catalog-parity');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(dir,'operations.dry-run.json'),
    JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log('WORK-only import plan: '+result.operations.length+
    ' operations; zero Shopify mutations. Saved privately to .work-catalog-parity/operations.dry-run.json');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
