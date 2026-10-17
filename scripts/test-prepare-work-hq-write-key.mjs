import assert from 'node:assert/strict';
import {reconcileWorkHqWriteKey} from './prepare-work-hq-write-key.mjs';
const key='B'.repeat(64);
const original=[
  '# LOCAL TEST ONLY',
  '[WORK.GOOGLE_CUSTOM_ORDERS_QA]',
  'JILL_HQ_MERCHANT_READ_SECRET='+'R'.repeat(64),
  '',
  '[WORK.CLOUDFLARE_ORDER_DESK]',
  'SHOPIFY_API_SECRET='+'S'.repeat(64),
  'JILL_WORK_SESSION_KEY_B64='+'K'.repeat(64),
  '',
  '[UNASSIGNED.GOOGLE_SCRIPT_SECRETS]',
  'SHOPIFY_ACCESS_TOKEN=never-move-me',
  '',
  '[LIVE.GOOGLE_CUSTOM_ORDER_REWARDS_CANDIDATE]',
  'SHOPIFY_ACCESS_TOKEN=another-test-value',
  '',
].join('\r\n');
const first=reconcileWorkHqWriteKey(original,{makeKey:()=>key});
assert.equal(first.changed,true);
const workPart=first.content.split('[UNASSIGNED.GOOGLE_SCRIPT_SECRETS]')[0];
assert.equal(workPart.split('JILL_HQ_MERCHANT_WRITE_SECRET=').length-1,2);
assert.equal(workPart.match(new RegExp(key,'g')).length,2);
assert.equal(first.content.split('[UNASSIGNED.GOOGLE_SCRIPT_SECRETS]')[1],
  original.split('[UNASSIGNED.GOOGLE_SCRIPT_SECRETS]')[1],
  'unknown and LIVE sections must stay byte-for-byte unchanged');
const next=reconcileWorkHqWriteKey(first.content,{
  makeKey:()=>{throw Error('must not rotate existing key');},
});
assert.equal(next.changed,false);
assert.equal(next.content,first.content);
const sole=first.content.replace(
  '[WORK.CLOUDFLARE_ORDER_DESK]\r\nJILL_HQ_MERCHANT_WRITE_SECRET='+key,
  '[WORK.CLOUDFLARE_ORDER_DESK]');
assert.equal(reconcileWorkHqWriteKey(sole).changed,true);
assert.equal(reconcileWorkHqWriteKey(sole).content,first.content);
assert.throws(()=>reconcileWorkHqWriteKey(first.content.replace(
  'JILL_HQ_MERCHANT_WRITE_SECRET='+key,
  'JILL_HQ_MERCHANT_WRITE_SECRET='+'C'.repeat(64))),/mismatch/);
assert.throws(()=>reconcileWorkHqWriteKey(original,{
  makeKey:()=>('R'.repeat(64)),
}),/not_distinct/);
assert.throws(()=>reconcileWorkHqWriteKey(original,{
  makeKey:()=>('abc'),
}),/invalid_generated/);
assert.throws(()=>reconcileWorkHqWriteKey(original.replace(
  '[WORK.CLOUDFLARE_ORDER_DESK]','[LIVE.OTHER]')),/missing_or_duplicate/);
assert.throws(()=>reconcileWorkHqWriteKey(original.replace(
  '[WORK.CLOUDFLARE_ORDER_DESK]',
  '[WORK.CLOUDFLARE_ORDER_DESK]\r\nJILL_HQ_MERCHANT_WRITE_SECRET=INVALID!')),
  /invalid_existing/);
assert.throws(()=>reconcileWorkHqWriteKey(original.replace(
  '[WORK.CLOUDFLARE_ORDER_DESK]',
  '[WORK.CLOUDFLARE_ORDER_DESK]\r\nJILL_HQ_MERCHANT_WRITE_SECRET='+key+
  '\r\nJILL_HQ_MERCHANT_WRITE_SECRET='+key)),/duplicate_write_key/);
console.log('PASS private WORK key prep: one matched secret, idempotence, mismatch denial, zero LIVE/unassigned edits, distinct credentials.');
