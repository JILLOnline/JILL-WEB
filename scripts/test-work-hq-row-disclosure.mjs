// OFFLINE WORK HQ Requests interaction-contract test. No Cloudflare,
// Shopify Admin, Google QA, D1, mutation or browser automation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dir='services/jill-order-desk/app-home/app/';
const route=readFileSync(dir+'routes/app.requests.tsx','utf8');
const css=readFileSync(dir+'styles/inbox.css','utf8');
const actions=readFileSync(dir+'components/WorkRequestQuickActions.tsx','utf8');
const actionCss=readFileSync(dir+'styles/request-actions.css','utf8');
const beginning=route.indexOf('<button type="button" className="jill-inbox__row-trigger"');
const ending=route.indexOf('      </button>',beginning);
assert(beginning>=0&&ending>beginning,'Native details opener must exist');
const opener=route.slice(beginning,ending);
assert.match(opener,/aria-expanded=\{detailsOpen\}/);
assert.match(opener,/aria-controls=\{"jill-inbox-details-"/);
assert.match(opener,/aria-label=\{\(detailsOpen\?"Hide":"Show"\)/);
assert.match(opener,/onClick=\{toggleDetails\}/);
for(const name of ['customer','request','status','stage','needed','submitted'])
 assert.match(opener,new RegExp('jill-inbox__cell--'+name+'\\b'));
assert.equal((opener.match(/className="jill-inbox__cell jill-inbox__cell--/g)||[]).length,6);
assert.doesNotMatch(opener,/<Link\b|<a\b|<input\b|<select\b|<textarea\b|<button\b.*<button\b/s,
  'Do not nest another interactive control within native opener');
assert.doesNotMatch(opener,/<div className="jill-inbox__cell/,
  'Phrasing content only inside native button');
const outside=route.slice(ending);
assert.match(outside,/<WorkRequestQuickActions record=\{item\} enabled=\{controlsEnabled\} direct\/>/);
assert.match(outside,/<ArchiveControl item=\{item\}/);
assert.match(outside,/id=\{"jill-inbox-details-"/);
assert.match(outside,/hidden=\{!detailsOpen\}/);
assert.match(outside,/WorkOrderDetailsContent model=\{orderDetails\.data\}/);
assert.match(outside,/Open full request/);
assert.match(route,/orderDetails\.load\("\/app\/requests\/"\+encodeURIComponent\(item\.submission_id\)\)/);
assert.match(route,/requestedId\.current!==item\.submission_id/);
assert.match(route,/requestAnimationFrame\(\(\)=>/);
assert.match(route,/node\.scrollIntoView\(\{block:"nearest",inline:"nearest"/);
assert.doesNotMatch(route,/jill-inbox__detail-button/);
assert.doesNotMatch(route,/enabled=\{controlsEnabled\} compact\/>/);
assert.match(actions,/direct=false/);
assert.match(actions,/: compact\s*\? <div className="jill-actions__quick-menu">/);
assert.match(actions,/className="jill-actions__direct-buttons"/);
const controls=actions.slice(actions.indexOf('className="jill-actions__direct-buttons"'),
  actions.indexOf(': compact'));
assert.match(controls,/Message customer/);
assert.match(controls,/Update status/);
assert.match(controls,/aria-expanded=\{panel==="message"\}/);
assert.match(controls,/aria-expanded=\{panel==="status"\}/);
assert.match(actions,/action:"\/app\/requests\/command"/);
assert.match(actions,/expected_revision:String\(record\.revision\)/);
assert.match(actions,/operation\.current="jill:hq:"\+kind/);
assert.match(css,/\.jill-inbox__row-trigger\{/);
assert.match(css,/grid-template-columns:subgrid/);
assert.match(css,/grid-column:1 \/ span 6/);
assert.match(css,/\.jill-inbox__order-details\[hidden\]\{display:none\}/);
assert.match(css,/@media\(max-width:1160px\)/);
assert.match(css,/@media\(max-width:760px\)/);
assert.match(css,/\.jill-inbox__row-trigger:focus-visible/);
assert.match(css,/\.jill-inbox__row:has\(\.jill-actions__body\) \.jill-actions--direct/);
assert.match(actionCss,/\.jill-actions__direct-buttons button\{/);
assert.match(actionCss,/\.jill-actions__direct-status/);
assert.match(actionCss,/min-height:44px/);
for(const x of [css,actionCss,route,actions])
 assert.doesNotMatch(x,/window\.parent|parent\.document|document\.body\.style|position:\s*fixed|height:\s*100vh|overflow-y:\s*(?:auto|scroll)|!important/);
console.log('PASS WORK requests: six-cell keyboard button expands order details, direct message/status sibling actions, reviewed source-only UI, no nested scroll or commerce writes.');
