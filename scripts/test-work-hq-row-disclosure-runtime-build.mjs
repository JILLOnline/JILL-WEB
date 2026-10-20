// Pure offline review of the user-approved WORK UI-only deploy artifact.
// No remote calls or build artifact creation until the separate explicit
// release runner; only Git blob reading and inspected source.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewedRowRuntime,ROW_DISCLOSURE_RUNTIME_FILES}
  from './work-hq-row-disclosure-runtime-build.mjs';
import {TABLE_ROWS_BLOBS} from './work-hq-table-rows-package.mjs';
import {TABLE_ROWS_RUNTIME_FILES} from './work-hq-table-rows-build.mjs';
import {ROW_DISCLOSURE_BLOBS}
  from './work-hq-row-disclosure-edition.mjs';
const info=reviewedRowRuntime();
assert.equal(info.environment,'WORK');
assert.equal(info.runtime_files,20);
assert.deepEqual(ROW_DISCLOSURE_RUNTIME_FILES,TABLE_ROWS_RUNTIME_FILES);
assert.deepEqual([...info.changed_files].sort(),[
 'services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx',
 'services/jill-order-desk/app-home/app/routes/app.requests.tsx',
 'services/jill-order-desk/app-home/app/styles/inbox.css',
 'services/jill-order-desk/app-home/app/styles/request-actions.css',
].sort());
for(const file of TABLE_ROWS_RUNTIME_FILES){
 assert.equal(info.files[file],
   info.changed_files.includes(file)?ROW_DISCLOSURE_BLOBS[file]:TABLE_ROWS_BLOBS[file]);
}
assert.equal(info.sql_proposals_excluded,true);
assert.equal(info.catalog_messaging_quote_backend_from_HEAD_excluded,true);
assert.equal(info.customer_app_and_theme_excluded,true);
const source=readFileSync('scripts/work-hq-row-disclosure-runtime-build.mjs','utf8');
assert.match(source,/\['-C',ROOT,'archive'/);
assert.match(source,/\['-C',ROOT,'cat-file','blob'/);
assert.match(source,/changed\.has\(file\)\?currentBlob\(file,hash\):historicBlob\(hash\)/);
assert.doesNotMatch(source,/versions['"],['"](?:upload|deploy)|draftOrderCreate|inventoryAdjust|deleteMany|wrangler d1 execute/);
console.log('PASS WORK HQ row disclosure release source: exactly 20 reviewed runtime files, only 4 Request UI changes; all prior backend blobs frozen; no SQL, unreviewed head, Cloudflare mutation, or LIVE.');
