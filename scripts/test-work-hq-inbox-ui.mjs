import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  customerStatusLabel,internalStatusLabel,requestShortId,dateLabel,
  selectInboxRecords,inboxStats,INBOX_FILTERS,
} from '../services/jill-order-desk/inbox-display.mjs';

const records=[
  {
    submission_id:'jill:qa:a97454fa-0984-49f0-b431-725b77c11047',
    customer_status:'reviewing',internal_status:'needs_quote',
    submitted_at:'2026-10-12T18:34:38.283Z',
    updated_at:'2026-10-12T18:45:02.173Z',
    date_needed:'',fulfillment:'',item_count:1,revision:1,
  },
  {
    submission_id:'jill:92b32355-900e-47ba-8946-ccd93190a3b7',
    customer_status:'received',internal_status:'new',
    submitted_at:'2026-10-13T21:13:57.364Z',
    updated_at:'2026-10-13T21:13:57.364Z',
    date_needed:'2026-10-30',fulfillment:'pickup',item_count:1,revision:1,
  },
];
const before=JSON.stringify(records);
assert.deepEqual(inboxStats(records),{total:2,reviewing:1,needsQuote:1});
assert.deepEqual(inboxStats([]),{total:0,reviewing:0,needsQuote:0});
assert.deepEqual(selectInboxRecords(records).map(r=>r.submission_id),
  [records[1].submission_id,records[0].submission_id]);
assert.deepEqual(selectInboxRecords(records,{sort:'oldest'}).map(r=>r.submission_id),
  [records[0].submission_id,records[1].submission_id]);
assert.deepEqual(selectInboxRecords(records,{sort:'needed'}).map(r=>r.submission_id),
  [records[1].submission_id,records[0].submission_id]);
assert.deepEqual(selectInboxRecords(records,{status:'reviewing'}),[records[0]]);
assert.deepEqual(selectInboxRecords(records,{status:'received'}),[records[1]]);
assert.deepEqual(selectInboxRecords(records,{status:'in_production'}),[]);
assert.deepEqual(selectInboxRecords(records,{query:'A97454FA'}),[records[0]]);
assert.deepEqual(selectInboxRecords(records,{query:'2026-10-30'}),[records[1]]);
assert.deepEqual(selectInboxRecords(records,{query:'  NEEDS_QUOTE  '}),[records[0]]);
assert.deepEqual(selectInboxRecords(records,{query:'pickup'}),[records[1]]);
assert.deepEqual(selectInboxRecords(records,{query:'no match'}),[]);
assert.equal(JSON.stringify(records),before,'A sort mutated canonical source records');
assert.equal(requestShortId(records[1].submission_id),'3190A3B7');
assert.equal(customerStatusLabel('reviewing'),'In review');
assert.equal(internalStatusLabel('needs_quote'),'Needs quote');
assert.equal(customerStatusLabel('unknown'),'Unknown status');
assert.equal(dateLabel('2026-10-30'),'Oct 30, 2026');
assert.equal(dateLabel('2026-10-13T21:13:57.364Z',{includeTime:true}),
  'Oct 13, 2026, 9:13 PM UTC');
assert.equal(dateLabel(''),'Not supplied');
assert.equal(dateLabel('bad-date'),'Not supplied');
assert.equal(INBOX_FILTERS[0][0],'all');
assert.deepEqual(new Set(INBOX_FILTERS.map(row=>row[0])).size,INBOX_FILTERS.length);

// The screen may only display the fields already projected by the owner-only
// merchant reader; never introduce an unverified customer profile or write.
const route=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
const style=readFileSync(
  'services/jill-order-desk/app-home/app/styles/inbox.css','utf8');
const helper=readFileSync(
  'services/jill-order-desk/inbox-display.mjs','utf8');
const landing=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.index.tsx','utf8');
// Shopify App Bridge must authenticate route DATA requests. React Router's
// automatic prefetch link requests may lack a fresh embedded session token;
// they have historically generated spurious /auth/login 200 navigation.
assert.match(readFileSync('services/jill-order-desk/app-home/app/routes/app.tsx','utf8'),/<NavLink to="\/app\/requests"/);
assert.doesNotMatch(landing,/prefetch\s*=/);
assert.doesNotMatch(route,/prefetch\s*=/);
const serverLoader=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts','utf8');
for(const expected of [
  'loadWorkMerchantInbox','workShopify(env).authenticate',
  'readWorkGoogleQaMerchantList',
])assert.ok(serverLoader.includes(expected),expected);
for(const expected of [
  'readOnly:boolean',
  'inboxStats','selectInboxRecords','useMemo','type="search"',
  'aria-live="polite"','ORDER DETAILS','<details',
])assert.ok(route.includes(expected),expected);
assert.match(route,/data\.state==="source_unavailable"/);
assert.doesNotMatch(route,/loadWorkMerchantInbox|workShopify\(|readWorkGoogleQaMerchantList|export async function loader/);
assert.match(route,/data\.state==="access_denied"/);
assert.match(route,/data\.state==="source_not_connected"/);
assert.match(route,/item\.submission_id/);
assert.match(route,/INBOX_FILTERS/);
assert.match(style,/@media\(max-width:700px\)/);
assert.match(style,/:focus-visible/);
assert.match(style,/prefers-reduced-motion/);
assert.ok(style.includes('.jill-inbox__card'));
assert.doesNotMatch(landing,/to="\/app\/requests"/);
assert.doesNotMatch(style,/!important|@import|url\(/i);
assert.doesNotMatch(route,/onClick=\{[^}]*fetch|fetch\(|useSubmit|action\s*\(|<form|<button\s+type="submit"|window\.location/i);
assert.match(route,/orderDetails\.load\("\/app\/requests\/"\+encodeURIComponent\(item\.submission_id\)\)/);
const quickActions=readFileSync(
  'services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx','utf8');
const actionStyle=readFileSync(
  'services/jill-order-desk/app-home/app/styles/request-actions.css','utf8');
// Compact card: one submitted timestamp, no duplicate three-field overview,
// one prominent uppercase disclosure, and one Owner-scoped primary route link.
assert.equal((route.match(/Submitted \{dateLabel\(item\.submitted_at/g)||[]).length,1);
assert.doesNotMatch(route,/jill-inbox__facts|jill-inbox__open|Open request/);
assert.match(route,/<summary>ORDER DETAILS/);
assert.match(quickActions,/\{compact\s*\? <div className="jill-actions__quick-menu">/);
assert.match(quickActions,/<details ref=\{quickMenu\} onKeyDown=/);
assert.match(quickActions,/<summary>[\s\S]*?QUICK ACTIONS/);
assert.match(quickActions,/aria-label="Quick actions"/);
assert.match(quickActions,/quickMenu\.current\.open=false/);
assert.match(quickActions,/event\.key==="Escape"/);
assert.match(quickActions,/onClick=\{\(\)=>openPanel\("status"\)\}/);
assert.match(quickActions,/onClick=\{\(\)=>openPanel\("message"\)\}/);
assert.match(quickActions,/to=\{"\/app\/requests\/"\+encodeURIComponent\(record\.submission_id\)\}/);
assert.match(quickActions,/Open request <span aria-hidden="true">→<\/span>/);
assert.match(quickActions,/aria-expanded=\{panel==="status"\}/);
assert.match(quickActions,/aria-expanded=\{panel==="message"\}/);
assert.match(quickActions,/action:"\/app\/requests\/command"/);
assert.match(actionStyle,/\.jill-actions__quick-menu summary\{/);
assert.match(actionStyle,/\.jill-actions__menu-options\{/);
assert.match(actionStyle,/\.jill-actions__menu-options button,/);
assert.match(actionStyle,/margin-inline:auto/);
assert.match(actionStyle,/min-height:44px/);
assert.doesNotMatch(actionStyle,/\.jill-actions--compact \.jill-actions__tabs\{/);
assert.match(actionStyle,/\.jill-actions--compact \.jill-actions__open-link/);
assert.match(actionStyle,/min-height:44px/);
assert.doesNotMatch(actionStyle,/!important|@import|url\(/i);
assert.doesNotMatch(route,/orderDetails\.submit|fetcher\.submit/);
assert.doesNotMatch(helper,/fetch\(|localStorage|sessionStorage|document\.cookie|window\.|https?:\/\//i);
assert.doesNotMatch(route,/SHOPIFY_ACCESS_TOKEN|JILL_CUSTOM_ORDER_GATEWAY_SECRET|JILL_SHEET_ID|shopify_customer_id|customer\.email/);
console.log('PASS JILL HQ WORK inbox UI: real read-only records, correct counters, accessible responsive cards, local filtering/sorting, no cross-store reads or mutations.');
