import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STOREFRONT_API,PROMOTIONS_MAX_AGE_MS,PERSONAL_WALLET_QUERY,
  PUBLIC_PROMOTIONS_QUERY,parsePersonalWallet,loadPersonalCoupons,
  parsePublicPromotionSnapshot,loadPublicPromotions,
} from '../shared/customer-coupons.mjs';
import {CUSTOMER_ACCOUNT_API} from '../shared/customer-account-api.mjs';

const now=Date.parse('2026-10-10T20:10:00Z');
const walletRecord={
  code:'TEST-REWARD-QA',points:10,value:5,minimum:25,
  status:'active',expires_at:'2026-11-09T20:10:00Z',
};
const wallet={value:JSON.stringify([walletRecord])};
assert.equal(STOREFRONT_API,'shopify://storefront/api/2026-07/graphql.json');
assert.equal(PROMOTIONS_MAX_AGE_MS,600000);
assert.match(PERSONAL_WALLET_QUERY,/customer\s*\{/);
assert.match(PERSONAL_WALLET_QUERY,/namespace: "jill_rewards", key: "coupons"/);
assert.match(PUBLIC_PROMOTIONS_QUERY,/shop\s*\{/);
assert.match(PUBLIC_PROMOTIONS_QUERY,/namespace: "jill_promotions"/);
assert.deepEqual(parsePersonalWallet({value:'[]'},now),[]);
assert.deepEqual(parsePersonalWallet(wallet,now),[{
  code:'TEST-REWARD-QA',points:10,value:5,minimum:25,
  status:'active',expiresAt:'2026-11-09T20:10:00Z',
}]);
assert.equal(parsePersonalWallet(wallet,Date.parse('2026-11-10T00:00:00Z'))[0].status,'expired');
assert.throws(()=>parsePersonalWallet(null,now),/unavailable/);
assert.throws(()=>parsePersonalWallet({value:''},now),/unavailable/);
assert.throws(()=>parsePersonalWallet({value:'not-json'},now),/invalid JSON/);
assert.throws(()=>parsePersonalWallet({value:'{}'},now),/unsupported format/);
assert.throws(()=>parsePersonalWallet({value:'[null]'},now),/invalid coupon status/);
assert.throws(()=>parsePersonalWallet({value:'[{"code":"A","points":10,"expires_at":"2030-01-01","status":"hijacked"}]'},now),/invalid coupon status/);
assert.throws(()=>parsePersonalWallet({value:'[{"code":"A","points":10,"expires_at":"not-date"}]'},now),/invalid coupon/);
assert.throws(()=>parsePersonalWallet({value:'[{"code":"","points":10,"expires_at":"2030-01-01"}]'},now),/invalid coupon/);
let apiCalls=0;
const personalRequest=async(url,opts)=>{
  ++apiCalls;
  assert.equal(url,CUSTOMER_ACCOUNT_API);
  assert.equal(opts.method,'POST');
  assert.equal(JSON.parse(opts.body).query,PERSONAL_WALLET_QUERY);
  return {ok:true,json:async()=>({data:{customer:{id:'gid://shopify/Customer/999',coupons:wallet}}})};
};
assert.equal((await loadPersonalCoupons(personalRequest,now))[0].code,walletRecord.code);
assert.equal(apiCalls,1);
await assert.rejects(loadPersonalCoupons(async()=>({ok:true,json:async()=>({data:{customer:null}})})),/Authenticated customer/);
await assert.rejects(loadPersonalCoupons(async()=>({ok:true,json:async()=>({errors:[{message:'no'}]})})),/rejected/);

// Customer-context isolation: the query must never accept a caller-selected
// customer ID. Two authenticated contexts must return only their own wallets.
assert.doesNotMatch(PERSONAL_WALLET_QUERY,/customer\\s*\\(/);
const accountWallets = new Map([
  ['qa-A',{id:'gid://shopify/Customer/101',coupons:{value:JSON.stringify([walletRecord])}}],
  ['qa-B',{id:'gid://shopify/Customer/202',coupons:{value:'[]'}}],
]);
function asAuthenticatedCustomer(key) {
  return async (url,opts) => {
    assert.equal(url,CUSTOMER_ACCOUNT_API);
    const body=JSON.parse(opts.body);
    assert.equal(body.query,PERSONAL_WALLET_QUERY);
    assert.equal(Object.hasOwn(body,'variables'),false);
    assert.doesNotMatch(opts.body,/gid:\\/\\/shopify\\/Customer\\/(101|202)/);
    return {ok:true,json:async()=>({data:{customer:accountWallets.get(key)}})};
  };
}
assert.deepEqual((await loadPersonalCoupons(asAuthenticatedCustomer('qa-A'),now)).map(c=>c.code),['TEST-REWARD-QA']);
assert.deepEqual(await loadPersonalCoupons(asAuthenticatedCustomer('qa-B'),now),[]);
await assert.rejects(loadPersonalCoupons(async()=>({ok:true,json:async()=>({data:{customer:null}})}),now),/Authenticated customer/);

const publicSnapshot=JSON.stringify({
  version:1,synced_at:'2026-10-10T20:08:42.379Z',
  offers:[{
    code:'FREESHIPPING2026',
    summary:'Free shipping on one-time purchase products',
    details:'Minimum quantity of 3',ends_at:'2026-12-31T23:59:59Z',
  }],
});
assert.deepEqual(parsePublicPromotionSnapshot(publicSnapshot,now),[{
  code:'FREESHIPPING2026',summary:'Free shipping on one-time purchase products',
  details:'Minimum quantity of 3',endsAt:'2026-12-31T23:59:59Z',
}]);
assert.deepEqual(parsePublicPromotionSnapshot(JSON.stringify({
  version:1,synced_at:'2026-10-10T20:08:42Z',offers:[],
}),now),[]);
assert.throws(()=>parsePublicPromotionSnapshot(null,now),/not synchronized/);
assert.throws(()=>parsePublicPromotionSnapshot('{}',now),/unsupported snapshot/);
assert.throws(()=>parsePublicPromotionSnapshot(JSON.stringify({
  version:1,synced_at:'2026-10-10T19:00:00Z',offers:[],
}),now),/fresh/);
assert.throws(()=>parsePublicPromotionSnapshot(JSON.stringify({
  version:1,synced_at:'2026-10-10T20:20:00Z',offers:[],
}),now),/fresh/);
assert.throws(()=>parsePublicPromotionSnapshot(JSON.stringify({
  version:1,synced_at:'2026-10-10T20:08:42Z',offers:[{}],
}),now),/invalid offer/);
const datedOffers = JSON.stringify({version:1,synced_at:'2026-10-10T20:08:42Z',offers:[
  {code:'CURRENT',summary:'Current',starts_at:'2026-10-09T00:00:00Z',ends_at:'2026-10-11T00:00:00Z'},
  {code:'FUTURE',summary:'Future',starts_at:'2026-10-11T00:00:00Z'},
  {code:'ENDED',summary:'Expired',ends_at:'2026-10-09T00:00:00Z'},
]});
assert.deepEqual(parsePublicPromotionSnapshot(datedOffers,now).map(x=>x.code),['CURRENT']);
assert.throws(()=>parsePublicPromotionSnapshot(JSON.stringify({
  version:1,synced_at:'2026-10-10T20:08:42Z',offers:[{code:'X',summary:'Bad',ends_at:'bogus'}],
}),now),/invalid offer date/);
let publicCalls=0;
const publicRequest=async(url,opts)=>{
  ++publicCalls;
  assert.equal(url,STOREFRONT_API);
  assert.equal(opts.method,'POST');
  assert.equal(JSON.parse(opts.body).query,PUBLIC_PROMOTIONS_QUERY);
  return {ok:true,json:async()=>({data:{shop:{promotionSnapshot:{value:publicSnapshot}}}})};
};
assert.equal((await loadPublicPromotions(publicRequest,now))[0].code,'FREESHIPPING2026');
assert.equal(publicCalls,1);
await assert.rejects(loadPublicPromotions(async()=>({ok:false,json:async()=>({})}),now),/unavailable/);
await assert.rejects(loadPublicPromotions(async()=>({ok:true,json:async()=>({errors:[{message:'fail'}]})}),now),/failed/);

const coupons=fs.readFileSync('extensions/jill-account-dashboard/src/pages/Coupons.jsx','utf8');
assert.match(coupons,/loadPersonalCoupons\(\)/);
assert.match(coupons,/loadPublicPromotions\(\)/);
assert.match(coupons,/setWallet\(\{status:'error',items:\[\]\}\)/);
assert.match(coupons,/setPublicOffers\(\{status:'error',items:\[\]\}\)/);
assert.doesNotMatch(coupons,/discountCartUrl\(|metafieldsSet|discountCodeBasicCreate/);
console.log('Read-only My JILL coupons: authenticated wallet, freshness, independent failures and no redemption mutations passed.');
