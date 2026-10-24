import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QUERIES,verifyWorkContactPostflight}
 from './verify-work-contact-d1-postflight.mjs';
const expected={
 jill_work_contact_tickets:'table',
 jill_work_contact_status_events:'table',
 jill_work_contact_messages:'table',
 jill_work_contact_tickets_updated:'index',
 jill_work_contact_tickets_account:'index',
 jill_work_contact_messages_by_ticket:'index',
 jill_contact_initial_event:'trigger',
 jill_contact_status_revision_guard:'trigger',
 jill_contact_status_event:'trigger',
};
const preserved=[
 'jill_merchant_audit','jill_merchant_authority','jill_merchant_grants',
 'jill_shopify_sessions','jill_work_quote_draft_operations',
 'jill_work_quote_drafts','jill_work_verified_inbox_index',
];
const migration=[{name:'0004_work_contact_tickets_source_only.sql'}];
const objects=Object.entries(expected).map(([name,type])=>({name,type}));
const rows=preserved.map(name=>({name}));
const report=verifyWorkContactPostflight({migration,objects,preserved:rows});
assert.equal(report.contact_migration_0004,'applied_history_verified');
assert.equal(report.status,'HOLD');
assert.equal(report.contact_schema,'all_3_tables_3_indexes_3_triggers_present');
assert.equal(report.preserved_existing_tables,7);
assert.equal(report.inspection_performed_writes,false);
assert.equal(report.customer_account_verified,false);
for(const [mode,unsafe] of [
 ['missing migration',{migration:[]}],
 ['other migration',{migration:[{name:'0003_work_verified_inbox_index.sql'}]}],
 ['missing trigger',{objects:objects.slice(0,-1)}],
 ['wrong type',{objects:objects.map((r,i)=>i===0?{...r,type:'index'}:r)}],
 ['duplicate object',{objects:[...objects.slice(1),objects[1]]}],
 ['missing existing table',{preserved:rows.slice(1)}],
 ['wrong existing table',{preserved:rows.map((r,i)=>i===0?{name:'private_customer'}:r)}],
 ['extra field',{preserved:rows.map((r,i)=>i===0?{...r,secret:'no'}:r)}],
]){
 assert.throws(()=>verifyWorkContactPostflight({
  migration,objects,preserved:rows,...unsafe,
 }),/work_contact_postflight_/,mode);
}
const sql=readFileSync(
 'services/jill-order-desk/migrations/0004_work_contact_tickets_source_only.sql','utf8');
assert.ok(Object.keys(expected).every(name=>sql.includes(name)));
assert.ok(Object.values(QUERIES).every(x=>x.startsWith('SELECT ')));
assert.ok(Object.values(QUERIES).every(x=>
 !/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA)\b/.test(x)));
const inspector=readFileSync('scripts/verify-work-contact-d1-postflight.mjs','utf8');
assert.doesNotMatch(inspector,/\b(?:d1 migrations apply|d1 time-travel restore|wrangler deploy)\b/);
assert.match(inspector,/--remote/);
assert.match(inspector,/--owner-readonly/);
console.log('PASS Contact 0004 postflight: WORK schema-history parity, 3 tables, 3 indexes, 3 triggers, preserved HQ tables; read only, hold.');
