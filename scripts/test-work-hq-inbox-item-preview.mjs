// WORK source-only: original signed Owner request details, no provider access.
// Prevent regression to customer/event-only inbox accordion (items were missing).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const path='services/jill-order-desk/app-home/app/components/WorkOriginalRequestDetails.tsx';
const source=readFileSync(path,'utf8');
const from=source.indexOf('export function WorkOrderDetailsContent(');
const to=source.indexOf('export function WorkOrderDetails(',from+1);
assert.ok(from>=0&&to>from,'Expected verified Owner detail content component');
const card=source.slice(from,to);
assert.match(card,/const details=verifiedDetails\(model,submissionId\)/,
 'Inbox cannot use an unverified or wrong submission detail');
assert.match(card,/\{stacked&&<div className="jill-request__original-items"/);
assert.match(card,/aria-label="Verified requested items and personalization"/);
assert.match(card,/Requested items \(\{details\.items\.length\}\)/);
assert.match(card,/details\.items\.map\(\(item,i\)=>/);
assert.match(card,/Qty \{item\.quantity\}/);
assert.match(card,/item\.variant_allocations\.map/);
assert.match(card,/Item options \(\{item\.attributes\.length\}\)/);
assert.match(card,/Per-unit personalization \(\{item\.personalization_groups\.length\}\)/);
assert.match(card,/<Attributes values=\{group\.attributes\}\/>/);
assert.match(card,/Secure previews are not available here/);
assert.doesNotMatch(card,/item\.reference_ids\.map|OpaqueReferences\s+ids=|customer\.email|customer\.phone\}\}\s*\|\|/);
const screen=readFileSync('services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
assert.match(screen,/WorkOrderDetailsContent model=\{orderDetails\.data\}/);
assert.match(screen,/submissionId=\{item\.submission_id\} stacked/);
assert.match(screen,/className="jill-inbox__row-trigger"/);
assert.match(screen,/WorkRequestQuickActions record=\{item\} enabled=\{controlsEnabled\}/);
assert.match(screen,/direct editorHost=\{editorHost\}/);
assert.match(screen,/Retry verified details/);
assert.doesNotMatch(card,/fetch\(|metafieldsSet|draftOrderCreate|localStorage|sessionStorage/);
console.log('PASS WORK HQ Requests: signed accordion includes item quantities, variants, P1/P2 options; private media never linked; direct actions retained.');
