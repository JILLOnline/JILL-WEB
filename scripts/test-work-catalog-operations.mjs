#!/usr/bin/env node
import assert from 'node:assert/strict';
import {JILL_CATALOG_CAPABILITIES} from '../merchant/jill-catalog-capabilities.mjs';
import {buildWorkCatalogOperations} from './build-work-catalog-operations.mjs';
const products=JILL_CATALOG_CAPABILITIES.map(x=>({
 handle:x.handle,title:x.title,vendor:'JILL',productType:'custom',tags:['test'],
 descriptionHtml:'<p>QA</p>',options:[{name:'Title',values:['Default Title']}],
 variants:[{title:'Default Title',price:'24.99',sku:null,taxable:true,inventoryPolicy:'CONTINUE',
   selectedOptions:[{name:'Title',value:'Default Title'}]}],
 images:[{url:'https://cdn.shopify.com/s/files/test.jpg',alt:'test'}],
 jillCapabilityProfileId:x.profile.id,jillCapabilityProfile:x.profile,
 personalizationProfileHandle:'pinata-number',customOrderExcluded:false,
}));
const profile={handle:'pinata-number',type:'jill_personalization_profile',
  fields:{name:'Piñata — Number',code:'pinata-number'}};
const source={schema:'jill.catalog-safe.v1',shop:'jillonlinestore.com',products,
 collections:[{handle:'pinatas',title:'Piñatas',productHandles:[products[0].handle],ruleSet:null}],
 profileDefinition:{type:'jill_personalization_profile',
  fields:[{key:'name',type:'single_line_text_field',required:true},
    {key:'code',type:'single_line_text_field',required:true}]},
 personalizationProfiles:[profile]};
const work={schema:'jill.catalog-safe.v1',shop:'jill-work.myshopify.com',
 products:[],collections:[],profileDefinition:null,personalizationProfiles:[]};
const result=buildWorkCatalogOperations(source,work);
assert.equal(result.mutationsExecuted,0);
assert.equal(result.target,'jill-work.myshopify.com');
assert.equal(result.operations.filter(x=>x.kind==='product.draft.create').length,15);
assert.equal(result.operations.filter(x=>x.kind==='product.profile.attach').length,15);
assert.equal(result.operations.filter(x=>x.kind==='metaobject.create').length,1);
assert.equal(result.operations.filter(x=>x.kind==='collection.create_unpublished').length,1);
assert.ok(result.operations.filter(x=>x.kind==='product.draft.create')
 .every(x=>x.input.status==='DRAFT'&&!Object.hasOwn(x.input,'id')));
assert.ok(result.operations.every(x=>JSON.stringify(x).indexOf('gid://shopify/Product/')===-1));
const bad=structuredClone(source);
bad.products[0].images[0].url='http://untrusted.example/image.jpg';
assert.throws(()=>buildWorkCatalogOperations(bad,work),/Unexpected image host/);
bad.products[0].images[0].url='https://cdn.shopify.com/s/files/test.jpg';
bad.products[0].jillCapabilityProfile.version=999;
assert.throws(()=>buildWorkCatalogOperations(bad,work),/capability definition differs/);
const existing=structuredClone(work);
existing.products=[structuredClone(products[0])];
existing.products[0].variants[0].price='9999.99';
assert.throws(()=>buildWorkCatalogOperations(source,existing),/Unresolved destination conflicts/);
console.log('WORK draft-only catalog operation ordering, source drift and media-host guards PASS');
