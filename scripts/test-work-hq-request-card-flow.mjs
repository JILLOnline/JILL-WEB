// OFFLINE WORK-only: distinctive card visuals and embedded scrolling must
// retain native document flow. Never touch Shopify parent/window scroll locks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REQUEST_CARD_FLOW_PACKAGE_BLOBS,REQUEST_CARD_FLOW_PACKAGE_FILES,
  checkWorkHqRequestCardFlow,requestCardFlowManifest}
  from './work-hq-request-card-flow-package.mjs';
import {CUSTOMER_NAME_PACKAGE_BLOBS} from './work-hq-customer-name-package.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';

const root='services/jill-order-desk/app-home/app/';
const route=readFileSync(root+'routes/app.requests.tsx','utf8');
const styles=readFileSync(root+'styles/inbox.css','utf8');
const quickActions=readFileSync(root+'components/WorkRequestQuickActions.tsx','utf8');
const shell=readFileSync(root+'routes/app.tsx','utf8');
const rootDoc=readFileSync(root+'root.tsx','utf8');

const review=checkWorkHqRequestCardFlow();
assert.equal(review.reviewed_files,13);
assert.equal(review.card_status_colors,true);
assert.equal(review.expanded_card_page_reflow,true);
assert.equal(review.no_provider_changes,true);
const frozen=requestCardFlowManifest();
assert.equal(frozen.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual(Object.keys(frozen.files).sort(),
  [...REQUEST_CARD_FLOW_PACKAGE_FILES].sort());
for(const sha of Object.values(frozen.files))assert.match(sha,/^[a-f0-9]{64}$/);
for(const [file,sha] of Object.entries(CUSTOMER_NAME_PACKAGE_BLOBS)){
  if(file.endsWith('/app/routes/app.requests.tsx') ||
    file.endsWith('/app/styles/inbox.css'))
    assert.notEqual(REQUEST_CARD_FLOW_PACKAGE_BLOBS[file],sha);
  else assert.equal(REQUEST_CARD_FLOW_PACKAGE_BLOBS[file],sha,
    'Only approved inbox TSX/CSS may differ');
}
// Colors use existing statuses; names are never classified by private customer traits.
for(const tone of ['received','reviewing','waiting','working','ready','muted']){
  assert.match(styles,new RegExp('jill-inbox__card--'+tone+'\\{'));
}
assert.match(styles,/--jill-card-ink/);
assert.match(styles,/--jill-card-wash/);
assert.match(styles,/border:2px solid var\(--jill-card-accent\)/);
assert.match(styles,/border-inline-start-width:4px/);
assert.match(styles,/font-size:clamp\(13px,1\.1vw,15px\)/);
assert.match(styles,/-webkit-line-clamp:2/);
assert.match(route,/STATUS_TONE\[item\.customer_status\]/);
assert.match(route,/className=\{"jill-inbox__card jill-inbox__card--"\+statusTone\+/);
// Dynamic native details/inline editors must take the full grid row, with
// the next row following naturally. No fixed heights or hidden scrollers.
assert.match(styles,/\.jill-inbox__card--expanded,/);
assert.match(styles,/\.jill-inbox__card:has\(\.jill-actions__quick-menu details\[open\]\)/);
assert.match(styles,/\.jill-inbox__card:has\(\.jill-actions__body\)/);
assert.match(styles,/grid-column:1\/-1/);
assert.match(styles,/height:auto;max-height:none/);
assert.match(styles,/scroll-margin-block-start:18px/);
assert.match(route,/requestAnimationFrame\(\(\)=>\{/);
assert.match(route,/node\.scrollIntoView\(\{block:"start",inline:"nearest"/);
assert.match(route,/behavior:reduced\?"auto":"smooth"/);
assert.match(route,/setDetailsOpen\(open\)/);
assert.match(quickActions,/<details ref=\{quickMenu\}/);
assert.match(quickActions,/quickMenu\.current\.open=false/);
assert.match(rootDoc,/<ScrollRestoration\/>/);
assert.match(shell,/<Outlet\/>/);
for(const src of [styles,route,quickActions,shell,rootDoc]){
  assert.doesNotMatch(src,/document\.body\.style\.(?:overflow|height)|parent\.document|window\.parent|iframe\.style/);
}
assert.doesNotMatch(styles,/height:\s*100vh|overflow-y:\s*(?:auto|scroll)|position:\s*fixed|!important/);
console.log('PASS WORK HQ request cards: distinct status border/name colors, full-row disclosure reflow, reduced-motion scroll into view, no nested scroll/Shopify parent manipulation. No deployment.');
