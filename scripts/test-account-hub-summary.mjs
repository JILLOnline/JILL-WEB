import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CUSTOMER_ACCOUNT_API,
  ACCOUNT_HUB_SUMMARY_QUERY,
  loadAccountHubSummary,
  normalizeAccountHubSummary,
  readNonnegativePoints,
} from '../shared/customer-account-api.mjs';

const base={
  customer:{
    id:'gid://shopify/Customer/999',
    displayName:'WORK QA Customer',
    pointsBalance:{value:'30'},
    pointsEarned:{value:'30'},
    pointsRedeemed:{value:'0'},
  },
};
assert.equal(CUSTOMER_ACCOUNT_API,'shopify://customer-account/api/2026-07/graphql.json');
assert.match(ACCOUNT_HUB_SUMMARY_QUERY,/customer\s*\{/);
assert.match(ACCOUNT_HUB_SUMMARY_QUERY,/namespace: "jill_rewards"/);
assert.doesNotMatch(ACCOUNT_HUB_SUMMARY_QUERY,/mutation|metafieldsSet|discountCodeBasicCreate/);
assert.deepEqual(normalizeAccountHubSummary(base),{
  displayName:'WORK QA Customer',pointsBalance:30,pointsEarned:30,pointsRedeemed:0,
});
assert.equal(readNonnegativePoints(null),null);
assert.equal(readNonnegativePoints({value:'0'}),0);
for(const value of ['-1','1.5','Infinity','NaN','1e2',' 3','9007199254740992','']) {
  assert.throws(()=>readNonnegativePoints({value}),/Invalid|safe integer/);
}
assert.deepEqual(normalizeAccountHubSummary({customer:{
  id:'gid://shopify/Customer/123',displayName:'',pointsBalance:null,
  pointsEarned:null,pointsRedeemed:null,
}}),{displayName:'',pointsBalance:null,pointsEarned:null,pointsRedeemed:null});
assert.throws(()=>normalizeAccountHubSummary({customer:null}),/Authenticated Shopify customer/);

let calls=0;
const request=async(url,options)=>{
  calls++;
  assert.equal(url,CUSTOMER_ACCOUNT_API);
  assert.equal(options.method,'POST');
  assert.equal(options.headers['Content-Type'],'application/json');
  const body=JSON.parse(options.body);
  assert.equal(body.query,ACCOUNT_HUB_SUMMARY_QUERY);
  assert.deepEqual(Object.keys(body),['query']);
  return {ok:true,json:async()=>({data:base})};
};
assert.deepEqual(await loadAccountHubSummary(request), normalizeAccountHubSummary(base));
assert.equal(calls,1);
await assert.rejects(
  loadAccountHubSummary(async()=>({ok:false,json:async()=>({})})),
  /Customer Account API unavailable/,
);
await assert.rejects(
  loadAccountHubSummary(async()=>({ok:true,json:async()=>({errors:[{message:'No access'}]})})),
  /Customer Account API rejected/,
);
await assert.rejects(
  loadAccountHubSummary(async()=>({ok:true,json:async()=>({data:{customer:null}})})),
  /Authenticated Shopify customer/,
);
const connected=fs.readFileSync('extensions/jill-account-dashboard/src/hub/ConnectedHub.jsx','utf8');
const shell=fs.readFileSync('extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
assert.match(connected,/loadAccountHubSummary\(\)/);
assert.match(connected,/status: 'error'/);
assert.match(connected,/active = false/);
assert.doesNotMatch(connected,/metafieldsSet|discountCodeBasicCreate|setInterval|write_customers/);
assert.match(shell,/accountState\.summary\.pointsBalance === null/);
assert.match(shell,/Unavailable/);
assert.match(shell,/Redemption is disabled/);
assert.doesNotMatch(shell,/fetch\(|metafieldsSet|shopify\.shop/);
console.log('My JILL WORK read-only Customer Account summary adapter passed valid, missing, invalid and API-error tests.');
