import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 signWorkGoogleOwnerBindingRequest,readWorkGoogleQaOwnerBinding,
} from '../services/jill-order-desk/work-google-owner-binding.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:11111111-2222-4333-8444-555555555555';
const GID='gid://shopify/Customer/111';
const NONCE='0123456789abcdefghijklmnopqrstuv';
const SECRET='merchant-work-owner-binding-test-hmac-secret-never-production';
const NOW=1792497600000;
const ENDPOINT='https://script.google.com/macros/s/AKfycbFutureOwnerLookupUnpublishedQA123456789/exec';
const v9='https://script.google.com/macros/s/AKfycby2CWe5_GeTfVwMlITER0psT5eO0UCysEsHXpiqWXTBHTICxKr5E584IA1ErxPPWIzH/exec';
const signReceipt=s=>createHmac('sha256',SECRET).update([
 'work_quote_owner_binding_v1',SHOP,ID,'3',
 s.owner_customer_gid,s.raw_payload_sha256,
 String(s.verified_at_ms),NONCE,
].join('\n'),'utf8').digest('hex');
const owner={
 version:1,operation:'custom_order.merchant.owner_binding.result',
 ok:true,shop:SHOP,submission_id:ID,source_revision:3,
 owner_status:'signed_shopify_customer',owner_customer_gid:GID,
 raw_payload_sha256:'a'.repeat(64),verified_at_ms:NOW-1000,
 nonce:NONCE,
};
const body=s=>({...s,signature:signReceipt(s)});
const expectedRequestSignature=createHmac('sha256',SECRET).update([
 'merchant_owner_binding_request_v1',SHOP,ID,'3',
 String(NOW),NONCE,
].join('\n'),'utf8').digest('hex');
assert.equal(signWorkGoogleOwnerBindingRequest({
 secret:SECRET,submissionId:ID,sourceRevision:3,
 timestamp:NOW,nonce:NONCE,
}),expectedRequestSignature);
assert.throws(()=>signWorkGoogleOwnerBindingRequest({
 secret:SECRET,submissionId:'someone@invalid.test',
 sourceRevision:3,timestamp:NOW,nonce:NONCE,
}),/invalid_request_signer/);

let calls=0;
const fetcher=async(url,opts)=>{
 calls++;
 assert.equal(url,ENDPOINT);
 assert.equal(opts.method,'POST');
 assert.equal(opts.redirect,'follow');
 assert.ok(opts.signal);
 assert.equal(opts.headers.accept,'application/json');
 const map=new URLSearchParams(opts.body);
 assert.deepEqual([...map.keys()],[
  'jill_order_merchant_owner_binding','shop','submission_id','source_revision',
  'jill_hq_read_ts','jill_hq_read_nonce','jill_hq_read_sig',
 ]);
 assert.equal(map.get('jill_order_merchant_owner_binding'),'1');
 assert.equal(map.get('shop'),SHOP);
 assert.equal(map.get('submission_id'),ID);
 assert.equal(map.get('source_revision'),'3');
 assert.equal(map.get('jill_hq_read_ts'),String(NOW));
 assert.equal(map.get('jill_hq_read_nonce'),NONCE);
 assert.equal(map.get('jill_hq_read_sig'),expectedRequestSignature);
 assert.equal(opts.body.toString().includes('example.test'),false);
 assert.equal(opts.body.toString().includes('Customer%2F111'),false,
  'Owner GID must never be sent in the lookup request');
 return new Response(JSON.stringify(body(owner)),{status:200});
};
const args={enabled:true,approvedEndpoint:ENDPOINT,secret:SECRET,
 submissionId:ID,sourceRevision:3,nonce:NONCE,now:()=>NOW};
await assert.rejects(()=>readWorkGoogleQaOwnerBinding({...args,enabled:false,
 backendFetch:()=>{calls++;throw Error('DO NOT CONTACT GOOGLE');}
}),/not_enabled/);
assert.equal(calls,0);
await assert.rejects(()=>readWorkGoogleQaOwnerBinding({...args,
 approvedEndpoint:v9,
 backendFetch:()=>{calls++;throw Error('DO NOT CONTACT GOOGLE');}
}),/unapproved_endpoint/);
assert.equal(calls,0,'Never reuse immutable detail @9');
await assert.rejects(()=>readWorkGoogleQaOwnerBinding({...args,
 approvedEndpoint:'https://example.com',
 backendFetch:()=>{calls++;throw Error('DO NOT CONTACT GOOGLE');}
}),/unapproved_endpoint/);
const verified=await readWorkGoogleQaOwnerBinding({...args,backendFetch:fetcher});
assert.equal(calls,1);
assert.equal(verified.owner_customer_gid,GID);
assert.equal(verified.raw_payload_sha256,owner.raw_payload_sha256);
assert.equal(verified.source_revision,3);
assert.equal(verified.nonce,NONCE);
assert.equal(verified.signature,signReceipt(owner));
assert.equal(JSON.stringify(verified).includes('email'),false);
assert.equal(JSON.stringify(verified).includes('address'),false);
const deny=async(payload,regex)=>assert.rejects(
 ()=>readWorkGoogleQaOwnerBinding({...args,
  backendFetch:async()=>new Response(JSON.stringify(payload),{status:200})}),
 regex);
await deny({...body(owner),owner_customer_gid:'gid://shopify/Customer/222'},
 /invalid_signed_receipt/);
await deny({...body(owner),signature:'f'.repeat(64)},/invalid_signed_receipt/);
await deny({...body(owner),source_revision:4},/invalid_signed_receipt/);
await deny({...body(owner),nonce:'v'.repeat(32)},/invalid_signed_receipt/);
await deny({...body(owner),verified_at_ms:NOW-120001},/invalid_signed_receipt/);
await deny({...body(owner),email:'leak@example.test'},/unexpected_payload/);
await assert.rejects(()=>readWorkGoogleQaOwnerBinding({...args,
 backendFetch:async()=>new Response('{}',{status:403})}),/unavailable/);
await assert.rejects(()=>readWorkGoogleQaOwnerBinding({...args,
 backendFetch:async()=>new Response('a'.repeat(3000),{status:200})}),/oversized/);
const source=readFileSync('services/jill-order-desk/work-google-owner-binding.mjs','utf8');
assert.doesNotMatch(source,/getSheet_|SpreadsheetApp|draftOrderCreate|draftOrderInvoiceSend|db\.batch/);
assert.match(source,/jill_order_merchant_owner_binding:'1'/);
assert.match(source,/verifyWorkQuoteOwnerBindingReceipt/);
assert.match(source,/approvedEndpoint===DENY_DETAIL/);
console.log('PASS future WORK Google owner-binding client: domain-separated signed request, nonce-bound receipt HMAC, strict no-PII 2 KB response, @9 denied, OFF makes zero requests.');
