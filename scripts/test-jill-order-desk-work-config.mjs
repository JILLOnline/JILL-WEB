import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../services/jill-order-desk/worker.mjs';

const cfg=readFileSync('services/jill-order-desk/wrangler.toml','utf8');
const form=readFileSync('services/jill-order-desk/migrations/0001_staff_authority.sql','utf8');
const publicGateway=readFileSync('services/custom-order-cloudflare/wrangler.toml','utf8');
for(const token of [
 'name = "jill-order-desk-work"',
 'main = "worker.mjs"',
 'binding = "JILL_ORDER_DESK_WORK_DB"',
 'database_name = "jill-order-desk-work"',
 'database_id = "3f17c186-c794-4e00-8f20-017191373a19"',
 'migrations_dir = "migrations"',
])assert.ok(cfg.includes(token),'Missing WORK D1 binding: '+token);
assert.doesNotMatch(cfg,/jqtdgr-1y|JILL_CUSTOM_ORDER_WORK_SHEET_ID|SHOPIFY_ACCESS_TOKEN/);
assert.doesNotMatch(publicGateway,/JILL_ORDER_DESK_WORK_DB|jill-order-desk-work/,
  'The public Custom Order gateway must never bind merchant D1');
assert.match(form,/CREATE TABLE IF NOT EXISTS jill_merchant_authority/);
assert.doesNotMatch(form,/^PRAGMA\s+foreign_keys\s*=/im,
  'D1 manages foreign key enforcement inside its transaction');
assert.match(form,/CREATE TABLE IF NOT EXISTS jill_merchant_grants/);
assert.match(form,/CREATE TABLE IF NOT EXISTS jill_merchant_audit/);
for(const [method,path,status] of [
  ['GET','/healthz',200],
  ['GET','/',503],
  ['GET','/admin',503],
  ['POST','/admin/bootstrap',503],
  ['POST','/api/merchant',503],
  ['OPTIONS','/api/merchant',503],
]){
 const response=await worker.fetch(new Request('https://jill-order-desk-work.workers.dev'+path,{method}));
 assert.equal(response.status,status,path);
 assert.match(response.headers.get('cache-control'),/no-store/);
 const data=await response.json();
 assert.equal(data.admin_ready,status===200?false:undefined);
 assert.equal(data.ok,status===200);
 assert.doesNotMatch(JSON.stringify(data),/3f17c186|owner_staff_id|staff_grants|session|token/i);
}
console.log('JILL WORK merchant D1 binding pinned; public gateway isolated; all merchant API routes fail closed until Shopify Admin host is certified.');
