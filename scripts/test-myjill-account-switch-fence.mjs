import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadAccountHubScopedSummary,normalizeAccountHubSummary,
 ACCOUNT_HUB_SUMMARY_QUERY,CUSTOMER_ACCOUNT_API}
 from '../shared/customer-account-api.mjs';
import {reconcileMyJillAccountScope}
 from '../shared/myjill-account-scope.mjs';
const A='gid://shopify/Customer/111',B='gid://shopify/Customer/222';
const data=id=>({customer:{id,displayName:'WORK synthetic',
 pointsBalance:{value:'10'},pointsEarned:null,pointsRedeemed:null}});
let requests=0;
const mock=id=>async(url,options)=>{
 requests++;
 assert.equal(url,CUSTOMER_ACCOUNT_API);
 assert.deepEqual(JSON.parse(options.body),{query:ACCOUNT_HUB_SUMMARY_QUERY});
 return {ok:true,json:async()=>({data:data(id)})};
};
const a=await loadAccountHubScopedSummary(mock(A));
const b=await loadAccountHubScopedSummary(mock(B));
assert.equal(requests,2);
assert.equal(a.principal,A);assert.equal(b.principal,B);
assert.deepEqual(a.summary,normalizeAccountHubSummary(data(A)));
assert.equal(JSON.stringify(a.summary).includes(A),false);
for(const bad of ['', 'user@example.invalid','gid://shopify/Customer/0',
 'gid://shopify/Order/111','gid://shopify/Customer/3/extra']){
 await assert.rejects(loadAccountHubScopedSummary(mock(bad)),
  /Authenticated Shopify account identity is unavailable/);
}
const first=reconcileMyJillAccountScope({},{
 type:'verified',principal:A,summary:a.summary,
});
assert.equal(first.status,'ready');assert.equal(first.scope,A);
const checking=reconcileMyJillAccountScope(first,{type:'checking'});
assert.equal(checking.scope,A);
assert.equal(checking.status,'loading');
assert.equal(checking.summary,null);
const same=reconcileMyJillAccountScope(checking,{
 type:'verified',principal:A,summary:a.summary,
});
assert.equal(same.scope,A,'Same owner preserves the hub instance');
const switched=reconcileMyJillAccountScope(checking,{
 type:'verified',principal:B,summary:b.summary,
});
assert.equal(switched.scope,B);
assert.notEqual(switched.scope,first.scope,
 'New Shopify owner remounts the entire customer hub');
for(const invalid of [{type:'failed'},{type:'verified',
 principal:'user@example.invalid',summary:a.summary},{}]){
 const denied=reconcileMyJillAccountScope(first,invalid);
 assert.equal(denied.scope,null);
 assert.equal(denied.summary,null);
 assert.equal(denied.status,'error');
}
for(const obj of [first,checking,same,switched])
 assert.equal(Object.isFrozen(obj),true);
const hub=readFileSync('extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
const connected=readFileSync('extensions/jill-account-dashboard/src/hub/ConnectedHub.jsx','utf8');
for(const token of [
 'loadAccountHubScopedSummary()','generation!==currentRead.current',
 'currententrychange','visibilitychange',
 "key={accountState.scope??'unverified'}",
 "type:'checking'","type:'failed'",
]){
 assert.ok(connected.includes(token),'missing account switch protection: '+token);
}
assert.match(hub,/const guardedScreen=accountState\?\.status==='ready'\?screen:null/);
assert.match(hub,/\{guardedScreen\}/);
assert.match(hub,/contactDrafts,setContactDrafts/);
assert.match(hub,/conversationDrafts,setConversationDrafts/);
assert.match(hub,/'contact-requests': <ContactRequests enabled=\{false\}/);
assert.doesNotMatch(connected+hub,/localStorage|sessionStorage|document\.cookie/);
console.log('PASS My JILL account switching: A/A retained, A/B remounts, guest/errors purge, pending hides personal screens, stale loads fenced; Contact OFF.');
