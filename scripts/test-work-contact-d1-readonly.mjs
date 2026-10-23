import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectSourceConfiguration,inspectRemoteSchemaRows,
 decodeWranglerReadOnlyResult,READ_ONLY_SQL,CONTACT_SCHEMA_NAMES}
 from './inspect-work-contact-d1-readonly.mjs';

const hq=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gateway=readFileSync(
 'services/custom-order-cloudflare/wrangler.toml','utf8');
const migration=readFileSync(
 'services/jill-order-desk/migrations/0004_work_contact_tickets_source_only.sql','utf8');
const context={hq,gateway,migration};
const report=inspectSourceConfiguration(context);
assert.equal(report.hq_binding_source,true);
assert.equal(report.gateway_has_no_contact_d1_binding,true);
assert.equal(report.source_migration_present,true);
assert.ok(report.expected_flags.includes('JILL_WORK_CONTACT_CLAIM_ENABLED'));
assert.ok(report.expected_flags.includes('JILL_WORK_CONTACT_THREAD_ENABLED'));
assert.match(READ_ONLY_SQL,/^SELECT name,type FROM sqlite_master WHERE name IN/);
assert.doesNotMatch(READ_ONLY_SQL,/\b(?:INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|PRAGMA)\b/i);
assert.equal(inspectRemoteSchemaRows([]).state,'unapplied');
const rows=CONTACT_SCHEMA_NAMES.map(name=>({
 name,type:name.startsWith('jill_contact_')?'trigger':'table'}));
assert.equal(inspectRemoteSchemaRows(rows).state,'present_unverified');
const partially=inspectRemoteSchemaRows(rows.slice(0,2));
assert.equal(partially.state,'partial_conflict');
assert.equal(partially.missing.length,4);
assert.deepEqual(decodeWranglerReadOnlyResult(JSON.stringify([
 {results:rows,success:true}])).found,[...CONTACT_SCHEMA_NAMES]);
for(const invalid of [
 [{name:'CUSTOMER_SECRET',type:'table'}],
 [rows[0],rows[0]],
 [{name:CONTACT_SCHEMA_NAMES[0],type:'view'}],
 Array(31).fill(rows[0]),
]){
 assert.throws(()=>inspectRemoteSchemaRows(invalid),/work_contact_inventory_remote_metadata_invalid/);
}
for(const invalid of ['not JSON','{"results":{"private":"data"}}']){
 assert.throws(()=>decodeWranglerReadOnlyResult(invalid),
 /work_contact_inventory_remote_metadata_invalid/);
}
assert.throws(()=>inspectSourceConfiguration({
 ...context,hq:{...hq,name:'jill-live'},
}),/work_contact_inventory_hq_binding_mismatch/);
assert.throws(()=>inspectSourceConfiguration({
 ...context,gateway:gateway+'\n[[d1_databases]]\n',
}),/work_contact_inventory_gateway_private_d1_exposure/);
assert.throws(()=>inspectSourceConfiguration({
 ...context,migration:'CREATE TABLE OTHER;',
}),/work_contact_inventory_source_migration_mismatch/);
console.log('PASS WORK Contact D1 Owner preflight: fixed scope, schema-only reads, no gateway binding, no mutation/promotion.');
