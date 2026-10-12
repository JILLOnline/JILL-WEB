#!/usr/bin/env node
import assert from 'node:assert/strict';
import {JILL_CATALOG_CAPABILITIES} from '../merchant/jill-catalog-capabilities.mjs';
import {planCatalogParity} from './plan-work-catalog-parity.mjs';
const products=JILL_CATALOG_CAPABILITIES.map(x=>({
  handle:x.handle,title:x.title,descriptionHtml:'<p>QA fixture</p>',
  variants:[{title:'Default Title',price:'24.99',selectedOptions:[]}],
  images:[{url:'https://example.test/image.png'}],
  jillCapabilityProfileId:x.profile.id,
}));
const collections=[
  {handle:'pinatas',productHandles:products.filter(p=>p.handle.includes('pinata')).map(p=>p.handle)},
  {handle:'jill',productHandles:products.map(p=>p.handle)},
];
const profileDefinition={type:'jill_personalization_profile',fields:[
  {key:'name',type:'single_line_text_field',required:true},
  {key:'code',type:'single_line_text_field',required:true},
]};
const personalizationProfiles=[
  {handle:'pinata-number',type:'jill_personalization_profile',
    fields:{name:'Piñata — Number',code:'pinata-number'}},
];
const source={schema:'jill.catalog-safe.v1',shop:'jillonlinestore.com',products,collections,
  profileDefinition,personalizationProfiles};
const work={schema:'jill.catalog-safe.v1',shop:'jill-work.myshopify.com',
  products:[],collections:[],profileDefinition:null,personalizationProfiles:[]};
const a=planCatalogParity(source,work);
assert.equal(a.dryRun,true);
assert.equal(a.noWrites,true);
assert.equal(a.summary.createProducts,15);
assert.equal(a.summary.createCollections,2);
assert.equal(a.summary.createProfiles,1);
assert.equal(a.summary.profileDefinitionAction,'CREATE_IN_WORK');
const mirrored=structuredClone(source);
mirrored.shop=work.shop;
mirrored.profileDefinition=structuredClone(profileDefinition);
let b=planCatalogParity(source,mirrored);
assert.equal(b.summary.createProducts,0);
assert.equal(b.products.filter(p=>p.action==='MATCH').length,15);
const diverged=structuredClone(mirrored);
diverged.products[0].variants[0].price='9000.00';
b=planCatalogParity(source,diverged);
assert.equal(b.summary.conflictingProducts,1);
assert.equal(b.products.filter(p=>p.action==='CONFLICT').length,1);
diverged.products[0].variants[0].price='24.99';
diverged.products[0].jillCapabilityProfileId='not-real';
b=planCatalogParity(source,diverged);
assert.equal(b.summary.reviewProducts,1);
assert.ok(b.products.some(p=>p.differences?.includes('jill_capabilities')));
const extra=structuredClone(mirrored);
extra.products.push({...products[0]});
assert.throws(()=>planCatalogParity(source,extra),/duplicate handle/);
const wrong=structuredClone(source);
wrong.shop='jillonlinestore.com.evil.example';
assert.throws(()=>planCatalogParity(wrong,work),/source must be JILL LIVE/);
wrong.shop=source.shop;
wrong.products.pop();
assert.throws(()=>planCatalogParity(wrong,work),/source catalog drift/);
const privateData=structuredClone(source);
privateData.customers=[{email:'private@example.test'}];
assert.throws(()=>planCatalogParity(privateData,work),/forbidden customers/);
console.log('WORK catalog parity dry-run, variant conflict, reference, drift and scope tests PASS');
