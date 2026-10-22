import assert from 'node:assert/strict';
import {selectWorkHomePriorities} from '../services/jill-order-desk/work-hq-home-priorities.mjs';
const rows=[
 {submission_id:'req-NEEDS123',customer_status:'reviewing',internal_status:'needs_quote',
  date_needed:'2026-11-20',updated_at:'2026-10-20T12:00:00Z',customer_name:'SECRET'},
 {submission_id:'req-PAST1234',customer_status:'in_production',internal_status:'printing',
  date_needed:'2026-10-19',updated_at:'2026-10-19T12:00:00Z'},
 {submission_id:'req-NEW12345',customer_status:'received',internal_status:'new',
  date_needed:'2026-11-25',updated_at:'2026-10-21T12:00:00Z'},
 {submission_id:'req-CLOSE123',customer_status:'completed',internal_status:'needs_quote',
  date_needed:'2026-10-01'},
 {submission_id:'req-FUTURE12',customer_status:'in_production',internal_status:'assembly',
  date_needed:'2026-11-29'},
 {submission_id:'https://bad.example/?token=1',customer_status:'reviewing',
  internal_status:'needs_quote'}
];
const original=structuredClone(rows);
const result=selectWorkHomePriorities(rows,{today:'2026-10-21'});
assert.deepEqual(result.map(x=>x.submission_id),
 ['req-NEEDS123','req-PAST1234','req-NEW12345']);
assert.deepEqual(result.map(x=>x.attention),
 ['Needs a quote','Requested date passed','New request']);
assert.equal(JSON.stringify(result).includes('SECRET'),false);
assert.equal(result[0].customer_name,undefined);
assert.deepEqual(rows,original);
assert.deepEqual(selectWorkHomePriorities(rows,{today:'invalid'}),[]);
assert.deepEqual(selectWorkHomePriorities(null),[]);
assert.deepEqual(selectWorkHomePriorities(rows,{today:'2026-10-21',limit:0}),[]);
assert.equal(selectWorkHomePriorities(rows,{today:'2026-10-21',limit:1}).length,1);
console.log('PASS authenticated Home priorities: bounded source projection, zero PII and no fabricated message/payment state.');
