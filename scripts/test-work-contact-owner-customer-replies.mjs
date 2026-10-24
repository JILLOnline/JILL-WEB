// Source-only Owner projection and UI security for customer-authored
// Contact replies. Verified D1 Owner route is still OFF in WORK.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectVerifiedOwnerContactReplies}
 from '../services/jill-order-desk/work-contact-ticket-detail.mjs';
const A='gid://shopify/Customer/111';
const B='gid://shopify/Customer/222';
const base=[
 {reply_sequence:1,actor_customer_gid:A,body_text:'Purple, please.',
  created_at_ms:1792860012345,operation_id:'SECRET_OP',
  customer_email:'SECRET_EMAIL'},
 {reply_sequence:2,actor_customer_gid:A,body_text:'Add the name Ava.',
  created_at_ms:1792860012350,claim_code:'SECRET_CLAIM'},
];
const result=projectVerifiedOwnerContactReplies({
 rows:base,claimedCustomerGid:A,
});
assert.deepEqual(result.map(x=>x.author),['customer','customer']);
assert.deepEqual(result.map(x=>x.sequence),[1,2]);
assert.equal(Object.isFrozen(result),true);
assert.equal(Object.isFrozen(result[0]),true);
for(const privateValue of ['SECRET_OP','SECRET_EMAIL','SECRET_CLAIM',A]){
 assert.equal(JSON.stringify(result).includes(privateValue),false);
}
for(const [rows,gid] of [
 [base,B],[base.map((x,i)=>({...x,...(i===1?{actor_customer_gid:B}:{})})),A],
 [[{...base[0],reply_sequence:2}],A],
 [[{...base[0],body_text:' \tBad '}],A],
 [[{...base[0],body_text:'bad\u0000text'}],A],
 [[{...base[0],created_at_ms:1}],A],
 [[base[1],base[0]],A],
 [Array(51).fill(base[0]),A],
]){
 assert.throws(()=>projectVerifiedOwnerContactReplies({
  rows,claimedCustomerGid:gid,
 }),/contact_detail_unverified/);
}
const source=readFileSync('services/jill-order-desk/work-contact-ticket-detail.mjs','utf8');
const route=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.contacts.$ticketId.tsx','utf8');
const migration=readFileSync(
 'services/jill-order-desk/migrations/0005_work_contact_customer_replies_source_only.sql','utf8');
const manifest=readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8');
assert.match(source,/customerRepliesEnabled=false/);
assert.match(source,/messageControlsEnabled===true&&customerRepliesEnabled===true/);
assert.match(source,/projectVerifiedOwnerContactReplies/);
assert.match(route,/customerRepliesEnabled:env\.JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED==="true"/);
assert.match(route,/item.author==="customer"\?"Customer":"JILL"/);
assert.match(route,/data\.customerReplies/);
assert.match(migration,/jill_contact_customer_reply_owner_guard/);
assert.doesNotMatch(manifest,/JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED/);
console.log('PASS: WORK Owner Contact reply view hides Customer GID/ops/private fields, validates sequence/ownership, and is feature-gated OFF in deployed manifest.');
