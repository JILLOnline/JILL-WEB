// Offline review of the centered compact menu. No Cloudflare writes/receipts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QUICK_PILL_FILES,QUICK_PILL_BLOBS,
  checkWorkHqQuickPill,quickPillManifest} from './work-hq-quick-pill-package.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
const review=checkWorkHqQuickPill();
assert.equal(review.reviewed_files,11);
assert.deepEqual([...QUICK_PILL_FILES].sort(),Object.keys(QUICK_PILL_BLOBS).sort());
const manifest=quickPillManifest();
assert.equal(manifest.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual([...QUICK_PILL_FILES].sort(),Object.keys(manifest.files).sort());
for(const hash of Object.values(manifest.files))assert.match(hash,/^[a-f0-9]{64}$/);
const base='services/jill-order-desk/app-home/app/';
const component=readFileSync(base+'components/WorkRequestQuickActions.tsx','utf8');
const css=readFileSync(base+'styles/request-actions.css','utf8');
const route=readFileSync(base+'routes/app.requests.tsx','utf8');
const actionItems=component.split('className="jill-actions__menu-options"')[1].split('</div>')[0];
assert.equal((actionItems.match(/<button/g)||[]).length,2);
assert.equal((actionItems.match(/<Link/g)||[]).length,1);
for(const action of ['Update status','Message customer','Open request'])
  assert.match(actionItems,new RegExp(action));
assert.match(component,/\{compact\s*\? <div className="jill-actions__quick-menu">/);
assert.match(component,/<details ref=\{quickMenu\} onKeyDown=/);
assert.match(component,/event\.key==="Escape"/);
assert.match(component,/quickMenu\.current\.open=false/);
assert.match(component,/<summary>[\s\S]*?QUICK ACTIONS/);
assert.match(component,/<div className="jill-actions__tabs">/);
assert.match(component,/action:"\/app\/requests\/command"/);
assert.match(component,/fetcher\.submit\(payload/);
assert.match(component,/aria-expanded=\{panel==="status"\}/);
assert.match(component,/aria-expanded=\{panel==="message"\}/);
assert.match(route,/<WorkRequestQuickActions record=\{item\} enabled=\{controlsEnabled\} compact\/>/);
assert.match(css,/\.jill-actions__quick-menu\{width:min\(100%,320px\);margin-inline:auto\}/);
assert.match(css,/\.jill-actions__menu-options\{/);
assert.match(css,/min-height:44px/);
assert.doesNotMatch(css,/!important|@import|url\(/i);
console.log('PASS HQ WORK centered quick pill: collapsed default, three accessible actions, Escape, existing handlers/navigation, 44px controls, frozen 11-file overlay, no deployment.');
