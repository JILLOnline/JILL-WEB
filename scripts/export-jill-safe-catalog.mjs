#!/usr/bin/env node
// Read-only, field-allowlisted catalog snapshot. Saves locally, never to GitHub.
// Requires Admin API token scoped only to the selected store; NEVER logs tokens.
import fs from 'node:fs';
import path from 'node:path';
const scope=process.argv[2];
if(!['live','work'].includes(scope)){console.error('Usage: node scripts/export-jill-safe-catalog.mjs live|work');process.exit(2);}
const targets={
  live:{host:'jqtdgr-1y.myshopify.com',shop:'jillonlinestore.com',token:'JILL_LIVE_ADMIN_TOKEN'},
  work:{host:'jill-work.myshopify.com',shop:'jill-work.myshopify.com',token:'JILL_WORK_ADMIN_TOKEN'},
};
const target=targets[scope],token=process.env[target.token];
if(!token){console.error('Missing '+target.token+'. No remote operation attempted.');process.exit(2);}
const endpoint='https://'+target.host+'/admin/api/2026-07/graphql.json';
const productQuery=`query SafeJillProducts($after:String) {
 shop {myshopifyDomain}
 products(first:50,after:$after){
  nodes{handle title status descriptionHtml
   options{name values}
   variants(first:100){nodes{title price compareAtPrice selectedOptions{name value}} pageInfo{hasNextPage}}
   media(first:100){nodes{__typename ... on MediaImage{alt image{url altText}}} pageInfo{hasNextPage}}
   profile:metafield(namespace:"jill",key:"personalization_profile"){reference{__typename ... on Metaobject{handle type}}}
   capability:metafield(namespace:"custom",key:"jill_product_capabilities"){value}
   override:metafield(namespace:"custom",key:"jill_product_page_capability_override"){value}
   excluded:metafield(namespace:"custom",key:"jill_custom_order_excluded"){value}
   label:metafield(namespace:"custom",key:"jill_custom_order_label"){value}
  }
  pageInfo{hasNextPage endCursor}
 }
}`;
const collectionQuery=`query SafeJillCollections($after:String){
 shop{myshopifyDomain}
 collections(first:50,after:$after){
  nodes{handle title descriptionHtml sortOrder
   ruleSet{appliedDisjunctively rules{column relation condition}}
   products(first:100){nodes{handle} pageInfo{hasNextPage}}
  }
  pageInfo{hasNextPage endCursor}
 }
}`;
const personalizationQuery=`query SafeJillPersonalization {
 shop{myshopifyDomain}
 metaobjectDefinitionByType(type:"jill_personalization_profile"){
   type fieldDefinitions{key name type{name} required}
 }
 metaobjects(type:"jill_personalization_profile",first:50){
   nodes{handle type fields{key type value}}
   pageInfo{hasNextPage}
 }
}`;
async function query(query,variables){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',
   'X-Shopify-Access-Token':token},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Shopify HTTP '+response.status+' (read-only export aborted)');
 const payload=await response.json();
 if(payload.errors?.length)throw new Error('Shopify GraphQL error (read-only export aborted)');
 if(payload.data?.shop?.myshopifyDomain!==target.host)throw new Error('Wrong store identity; aborting');
 return payload.data;
}
function parseOrNull(value){if(value==null)return null;return JSON.parse(value);}
const products=[],collections=[];
try{
 let after=null;
 do{
  const data=await query(productQuery,{after});
  for(const p of data.products.nodes){
   if(p.variants.pageInfo.hasNextPage||p.media.pageInfo.hasNextPage)
     throw new Error('Nested product pagination unsupported: '+p.handle);
   products.push({handle:p.handle,title:p.title,status:p.status,descriptionHtml:p.descriptionHtml,
    variants:p.variants.nodes,options:p.options,
    images:p.media.nodes.filter(m=>m.__typename==='MediaImage'&&m.image?.url)
      .map(m=>({url:m.image.url,alt:m.alt||m.image.altText||''})),
    jillCapabilityProfileId:parseOrNull(p.capability?.value)?.id||null,
    jillCapabilityProfile:parseOrNull(p.capability?.value),
    personalizationProfileHandle:p.profile?.reference?.handle||null,
    personalizationProfileType:p.profile?.reference?.type||null,
    capabilityOverride:parseOrNull(p.override?.value),
    customOrderExcluded:p.excluded?.value==='true',
    customOrderLabel:p.label?.value||null});
  }
  after=data.products.pageInfo.hasNextPage?data.products.pageInfo.endCursor:null;
 }while(after);
 after=null;
 do{
  const data=await query(collectionQuery,{after});
  for(const c of data.collections.nodes){
   if(c.products.pageInfo.hasNextPage)throw new Error('Nested collection pagination unsupported: '+c.handle);
   collections.push({handle:c.handle,title:c.title,descriptionHtml:c.descriptionHtml,sortOrder:c.sortOrder,
     ruleSet:c.ruleSet,productHandles:c.products.nodes.map(p=>p.handle)});
  }
  after=data.collections.pageInfo.hasNextPage?data.collections.pageInfo.endCursor:null;
 }while(after);
 const profileData=await query(personalizationQuery,{});
 if(profileData.metaobjects.pageInfo.hasNextPage)
   throw new Error('Personalization profile pagination would lose entries');
 const profileDefinition=profileData.metaobjectDefinitionByType
   ?{type:profileData.metaobjectDefinitionByType.type,
      fields:profileData.metaobjectDefinitionByType.fieldDefinitions.map(f=>({
        key:f.key,name:f.name,type:f.type.name,required:f.required}))}:null;
 const personalizationProfiles=profileData.metaobjects.nodes.map(p=>({
    handle:p.handle,type:p.type,fields:Object.fromEntries(p.fields
      .filter(f=>['name','code'].includes(f.key)).map(f=>[f.key,f.value]))}));
 const output={schema:'jill.catalog-safe.v1',shop:target.shop,sourceMyshopifyDomain:target.host,
    readOnly:true,productCount:products.length,collectionCount:collections.length,
    products,collections,profileDefinition,personalizationProfiles};
 // Store locally only. This directory is gitignored; never upload raw snapshots to GitHub.
 const dir=path.join(process.cwd(),'.work-catalog-parity');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const dest=path.join(dir,scope+'.safe.json');
 fs.writeFileSync(dest+'.tmp',JSON.stringify(output,null,2)+'\n',{mode:0o600});
 fs.renameSync(dest+'.tmp',dest);
 console.log('Read-only '+scope.toUpperCase()+' catalog snapshot: '+products.length+
   ' products, '+collections.length+' collections. Saved privately to .work-catalog-parity/'+scope+'.safe.json');
 console.log('No remote writes, customers, orders, or credentials exported.');
}catch(e){console.error('Catalog export stopped: '+e.message);process.exitCode=1;}
