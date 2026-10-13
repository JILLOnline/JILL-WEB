#!/usr/bin/env node
import assert from 'node:assert/strict';
import {planSiteShell} from './plan-work-site-shell.mjs';
const source={schema:'jill.site-shell-safe.v1',shop:'jillonlinestore.com',
  customerAccountMenuExcluded:true,pages:[
    {handle:'quote',title:'Custom Orders',body:'',templateSuffix:'our-story'},
    {handle:'welcome',title:'Welcome',body:'Welcome!',templateSuffix:'welcome'},
    {handle:'coupons',title:'Coupons',body:'Offers',templateSuffix:null},
    {handle:'contact',title:'Contact',body:'',templateSuffix:'contact'},
    {handle:'data-sharing-opt-out',title:'Privacy',body:'',templateSuffix:null},
  ],menus:[
    {handle:'main-menu',items:[
      {title:'Custom Orders',url:'https://jillonlinestore.com/pages/quote'},
      {title:'Home',url:'/'},
    ]},
    {handle:'footer',items:[{title:'Search',url:'/search'}]},
  ],
};
const work={schema:'jill.site-shell-safe.v1',shop:'jill-work.myshopify.com',
 customerAccountMenuExcluded:true,pages:[
   {handle:'custom-order',body:'',templateSuffix:'custom-order'},
   {handle:'contact',body:'',templateSuffix:'contact'},
   {handle:'data-sharing-opt-out',body:'',templateSuffix:null},
 ],menus:[]};
const result=planSiteShell(source,work);
assert.equal(result.dryRun,true);
assert.equal(result.noWrites,true);
assert.equal(result.pages.find(x=>x.handle==='quote').destinationHandle,'custom-order');
assert.equal(result.pages.find(x=>x.handle==='welcome').action,'CREATE_UNPUBLISHED');
assert.equal(result.pages.find(x=>x.handle==='coupons').action,'REVIEW_ACCOUNTS_BOUNDARY');
assert.equal(result.pages.find(x=>x.handle==='data-sharing-opt-out').action,'SHOPIFY_MANAGED_KEEP');
assert.equal(result.menus.find(x=>x.handle==='main-menu').desired[0].url,'/pages/custom-order');
const bad=structuredClone(source);
bad.menus.push({handle:'customer-account-main-menu',items:[]});
assert.throws(()=>planSiteShell(bad,work),/account or unknown LIVE menu/);
const wrong=structuredClone(work);
wrong.shop='jillonlinestore.com';
assert.throws(()=>planSiteShell(source,wrong),/incorrect WORK destination/);
wrong.shop=work.shop;
wrong.pages=wrong.pages.filter(x=>x.handle!=='custom-order');
assert.throws(()=>planSiteShell(source,wrong),/WORK QA custom-order page missing/);
console.log('WORK page navigation, legacy route mapping and Accounts isolation tests PASS');
