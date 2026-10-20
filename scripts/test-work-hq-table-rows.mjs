// WORK-only offline accessible compact table layout certification.
// No Cloudflare/Google/Shopify calls or source mutations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TABLE_ROWS_BLOBS,checkWorkHqTableRows}
  from './work-hq-table-rows-package.mjs';
import {ARCHIVE_SEARCH_BLOBS} from './work-hq-archive-search-package.mjs';
import {checkWorkHqTableRowsRuntime,tableRowsRuntimeManifest,
  TABLE_ROWS_RUNTIME_FILES} from './work-hq-table-rows-build.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';

const tested=checkWorkHqTableRows();
assert.equal(tested.compact_columns,7);
assert.equal(tested.reviewed_files,21);
const runtime=checkWorkHqTableRowsRuntime();
assert.equal(runtime.runtime_files,20);
assert.equal(runtime.inert_sql_proposal_excluded,true);
const manifest=tableRowsRuntimeManifest();
assert.equal(manifest.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual(Object.keys(manifest.files).sort(),[...TABLE_ROWS_RUNTIME_FILES].sort());
for(const hash of Object.values(manifest.files))assert.match(hash,/^[a-f0-9]{64}$/);
for(const [file,previous] of Object.entries(ARCHIVE_SEARCH_BLOBS)){
  const updated=TABLE_ROWS_BLOBS[file];
  if(['services/jill-order-desk/app-home/app/routes/app.requests.tsx',
      'services/jill-order-desk/app-home/app/styles/inbox.css'].includes(file))
    assert.notEqual(updated,previous,'Expected reviewed table appearance change');
  else assert.equal(updated,previous,'Backend/other UI file unexpectedly changed: '+file);
}
const root='services/jill-order-desk/app-home/app/';
const route=readFileSync(root+'routes/app.requests.tsx','utf8');
const css=readFileSync(root+'styles/inbox.css','utf8');
const quick=readFileSync(root+'components/WorkRequestQuickActions.tsx','utf8');
const archived=readFileSync(root+'routes/app.requests.archive.tsx','utf8');
const searched=readFileSync(root+'routes/app.requests.search.tsx','utf8');
assert.equal((route.match(/<span>(Customer|Request|Status|Stage|Needed by|Submitted|Actions)<\/span>/g)||[]).length,7);
for(const col of ['customer','request','status','stage','needed','submitted','actions'])
  assert.match(route,new RegExp('jill-inbox__cell--'+col+'\\b'));
assert.match(route,/aria-controls=\{"jill-inbox-details-"/);
assert.match(route,/aria-expanded=\{detailsOpen\}/);
assert.match(route,/onClick=\{toggleDetails\}/);
assert.match(route,/orderDetails\.load\("\/app\/requests\/"\+encodeURIComponent\(item\.submission_id\)\)/);
assert.match(route,/WorkOrderDetailsContent model=\{orderDetails\.data\}/);
assert.match(route,/<time dateTime=\{item\.submitted_at\}/);
assert.match(route,/readOnly:boolean/);
assert.match(route,/ArchiveControl item=\{item\}/);
assert.match(route,/startFullSearch/);
assert.match(css,/grid-template-columns:var\(--jill-list-cols\)/);
assert.match(css,/\.jill-inbox__card:nth-child\(even\)/);
assert.match(css,/border-inline-start:4px solid var\(--jill-card-accent\)/);
assert.match(css,/\.jill-inbox__row:has\(\.jill-actions__body\)/);
assert.match(css,/\.jill-inbox__row:has\(\.jill-actions__feedback\)/);
assert.match(css,/\.jill-inbox__order-details\{/);
assert.match(css,/@media\(max-width:1160px\)/);
assert.match(css,/@media\(max-width:760px\)/);
assert.match(css,/text-overflow:ellipsis/);
assert.match(quick,/<details ref=\{quickMenu\}/);
assert.match(quick,/action:"\/app\/requests\/command"/);
assert.match(archived,/JILL_WORK_HQ_ARCHIVE_ENABLED==="true"/);
assert.match(searched,/handleWorkRequestDetailSearch/);
for(const file of [route,css]){
  assert.doesNotMatch(file,/document\.body\.style|parent\.document|window\.parent|position:\s*fixed|height:\s*100vh|overflow-y:\s*(?:auto|scroll)/);
}
console.log('PASS WORK HQ: 7 matching table columns; single-line rows; responsive mobile, full-width details, quick menus and editor flow, status colors, verified names, unchanged Owner Archive/Search and inert SQL. OFFLINE.');
