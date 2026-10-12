#!/usr/bin/env node
// Read-only WORK parity planner. Does not access Shopify or change any store.
// Inputs are approved, sanitized snapshots—not arbitrary Admin GraphQL dumps.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JILL_CATALOG_CAPABILITIES} from '../merchant/jill-catalog-capabilities.mjs';

export const SOURCE_SHOP='jillonlinestore.com';
export const WORK_SHOP='jill-work.myshopify.com';
const own=new Set(JILL_CATALOG_CAPABILITIES.map(x=>x.handle));

function required(ok,message){if(!ok)throw new Error('Catalog parity blocked: '+message);}
function uniqueByHandle(items,subject){
  required(Array.isArray(items),subject+' must be an array');
  const m=new Map();
  for(const x of items){
    required(x && typeof x.handle==='string' && /^[a-z0-9-]+$/.test(x.handle),subject+' invalid handle');
    required(!m.has(x.handle),subject+' duplicate handle: '+x.handle);
    m.set(x.handle,x);
  }
  return m;
}
const values=x=>Array.isArray(x)?x:[];
function variantKey(v){
  return values(v.selectedOptions).map(o=>o.name+'='+o.value).sort().join('|') || v.title || 'Default Title';
}
function variantSignature(v){
  return JSON.stringify({price:String(v.price),compareAtPrice:v.compareAtPrice==null?null:String(v.compareAtPrice),selectedOptions:values(v.selectedOptions).map(o=>({name:o.name,value:o.value})).sort((a,b)=>a.name.localeCompare(b.name))});
}
function variantDifferences(source,work){
  const a=new Map(),b=new Map();
  for(const v of values(source.variants)){const key=variantKey(v);required(!a.has(key),'duplicate source variant '+source.handle+'/'+key);a.set(key,variantSignature(v));}
  for(const v of values(work.variants)){const key=variantKey(v);required(!b.has(key),'duplicate WORK variant '+work.handle+'/'+key);b.set(key,variantSignature(v));}
  return [...new Set([...a.keys(),...b.keys()])].filter(key=>a.get(key)!==b.get(key));
}
function collectionsMap(items,subject){
  return uniqueByHandle(items,subject);
}
export function planCatalogParity(source,work){
  required(source?.shop===SOURCE_SHOP,'source must be JILL LIVE');
  required(work?.shop===WORK_SHOP,'destination must be JILL WORK');
  required(source?.schema==='jill.catalog-safe.v1' && work?.schema==='jill.catalog-safe.v1',
    'use versioned sanitized catalog snapshots');
  for(const input of [source,work]){
    for(const name of ['customers','orders','accessTokens','credentials','paymentMethods']){
      required(!Object.hasOwn(input,name),'forbidden '+name+' payload');
    }
  }
  const a=uniqueByHandle(source.products,'source products');
  const b=uniqueByHandle(work.products,'WORK products');
  const missingCanonical=[...own].filter(handle=>!a.has(handle));
  const notCanonical=[...a.keys()].filter(handle=>!own.has(handle));
  required(!missingCanonical.length && !notCanonical.length,
    'source catalog drift: missing='+missingCanonical.join(',')+' extra='+notCanonical.join(','));
  const ca=collectionsMap(source.collections,'source collections');
  const cb=collectionsMap(work.collections,'WORK collections');
  required(source.profileDefinition?.type==='jill_personalization_profile',
    'LIVE personalization definition missing or invalid');
  const pa=uniqueByHandle(source.personalizationProfiles,'LIVE personalization profiles');
  const pb=uniqueByHandle(work.personalizationProfiles||[],'WORK personalization profiles');
  const profileDefinitionAction=work.profileDefinition?.type==='jill_personalization_profile'
    ? 'EXISTS' : 'CREATE_IN_WORK';
  const profiles=[];
  for(const [handle,p] of pa){
    const dest=pb.get(handle);
    const status=!dest?'CREATE_IN_WORK':p.type!==dest.type||
      JSON.stringify(p.fields)!==JSON.stringify(dest.fields)?'CONFLICT':'MATCH';
    profiles.push({handle,action:status});
  }
  const products=[];
  for(const [handle,p] of a){
    const target=b.get(handle);
    const capability=JILL_CATALOG_CAPABILITIES.find(x=>x.handle===handle);
    required(capability?.profile?.id,'no canonical capability profile for '+handle);
    required(!p.jillCapabilityProfileId || p.jillCapabilityProfileId===capability.profile.id,
      'LIVE capability drift from repository: '+handle);
    required(p.personalizationProfileHandle!==null || !Object.hasOwn(p,'personalizationProfileHandle'),
      'LIVE personalization profile unresolved: '+handle);
    required(!p.personalizationProfileHandle || pa.has(p.personalizationProfileHandle),
      'LIVE product refers to missing personalization profile: '+handle);
    if(!target){
      products.push({handle,action:'CREATE_DRAFT',variantCount:values(p.variants).length,profileId:capability.profile.id});
      continue;
    }
    const variants=variantDifferences(p,target);
    const attrs=[];
    if(p.title!==target.title)attrs.push('title');
    if(values(p.images).length!==values(target.images).length)attrs.push('media_count');
    if(p.descriptionHtml!==target.descriptionHtml)attrs.push('description');
    const targetProfile=target.jillCapabilityProfileId;
    if(targetProfile!==capability.profile.id)attrs.push('jill_capabilities');
    if(p.personalizationProfileHandle &&
       p.personalizationProfileHandle!==target.personalizationProfileHandle)
      attrs.push('personalization_profile');
    if(values(p.images).length===values(target.images).length){
      const names=items=>items.map(x=>{try{return new URL(x.url).pathname.split('/').pop();}catch{return '';}}).sort();
      if(JSON.stringify(names(values(p.images)))!==JSON.stringify(names(values(target.images))))
        attrs.push('media_identity');
    }
    products.push({handle,action:variants.length?'CONFLICT':attrs.length?'REVIEW_UPDATE':'MATCH',
      differences:attrs,variantKeys:variants,profileId:capability.profile.id});
  }
  const collections=[];
  for(const [handle,c] of ca){
    const target=cb.get(handle);
    if(!target){collections.push({handle,action:'CREATE_UNPUBLISHED',productHandles:values(c.productHandles)});continue;}
    const sourceMembers=values(c.productHandles).slice().sort();
    const destMembers=values(target.productHandles).slice().sort();
    const same=JSON.stringify(sourceMembers)===JSON.stringify(destMembers);
    const sameRules=JSON.stringify(c.ruleSet||null)===JSON.stringify(target.ruleSet||null);
    collections.push({handle,action:!sameRules?'CONFLICT_RULES':same?'MATCH':'REVIEW_MEMBERSHIP',
      sourceCount:sourceMembers.length,workCount:destMembers.length});
  }
  return {schema:'jill.catalog-parity-plan.v1',sourceShop:SOURCE_SHOP,destinationShop:WORK_SHOP,
    dryRun:true,noWrites:true,
    summary:{sourceProducts:a.size,workProducts:b.size,sourceCollections:ca.size,workCollections:cb.size,
      createProducts:products.filter(x=>x.action==='CREATE_DRAFT').length,
      conflictingProducts:products.filter(x=>x.action==='CONFLICT').length,
      reviewProducts:products.filter(x=>x.action==='REVIEW_UPDATE').length,
      createCollections:collections.filter(x=>x.action==='CREATE_UNPUBLISHED').length,
      createProfiles:profiles.filter(x=>x.action==='CREATE_IN_WORK').length,
      conflictingProfiles:profiles.filter(x=>x.action==='CONFLICT').length,
      profileDefinitionAction,
      unrelatedWorkProducts:[...b.keys()].filter(h=>!a.has(h))},
    products,collections,profiles,
    notes:['No inventory, customers, orders, or production IDs may be migrated.',
      'CREATES must remain draft and collections unpublished until validated.',
      'Shopify metaobject references require independent destination IDs.',
      'No source or destination store is modified by this planner.']};
}
const called=fileURLToPath(import.meta.url)===path.resolve(process.argv[1]||'');
if(called){
  const [sourcePath,workPath]=process.argv.slice(2);
  if(!sourcePath||!workPath){console.error('Usage: node scripts/plan-work-catalog-parity.mjs <safe-live-snapshot.json> <safe-work-snapshot.json>');process.exit(2);}
  try{
    const plan=planCatalogParity(JSON.parse(fs.readFileSync(sourcePath,'utf8')),JSON.parse(fs.readFileSync(workPath,'utf8')));
    console.log(JSON.stringify(plan,null,2));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
