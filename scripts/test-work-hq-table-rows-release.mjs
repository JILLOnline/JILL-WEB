// OFFLINE-only verification of unique compact Requests table release receipt.
import assert from 'node:assert/strict';
import {TABLE_ROWS_PROFILE as current} from './release-work-hq-table-rows-owner.mjs';
import {ARCHIVE_SEARCH_PROFILE as last}
  from './release-work-hq-archive-search-owner.mjs';
import {WORKSPACE_LAYOUT_PROFILE as old}
  from './release-work-hq-workspace-layout-owner.mjs';
import {checkWorkHqTableRowsRuntime,prepareTableRowsRuntimeBuild}
  from './work-hq-table-rows-build.mjs';
import {visualBaseline,ownedVisualAllocation}
  from './release-work-hq-visual-theme-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';

assert.equal(checkWorkHqTableRowsRuntime().runtime_files,20);
assert.equal(current.base,'ecf3bfd8-091a-4ef4-ae84-ad58c61ee92a');
assert.equal(current.deployment,'5eaa3555-b7b5-4011-a180-fa430b247427');
assert.equal(current.baseSource,'1adbdeb6e469cfd74f4d47a2aef29a5fbfe36b87');
assert.equal(current.receiptStem,'work-hq-compact-rows-v1');
assert.equal(current.uploadOperation,'HQ_COMPACT_ROWS_V1_INACTIVE_UPLOAD');
assert.equal(current.activationOperation,'HQ_COMPACT_ROWS_V1_ACTIVATE');
assert.equal(current.restoreOperation,'HQ_COMPACT_ROWS_V1_RESTORE');
assert.equal(current.changeScope,'frozen_twenty_file_hq_compact_rows_no_schema_or_backend_mutation');
assert.equal(current.guard,checkWorkHqTableRowsRuntime);
assert.equal(current.prepareBuild,prepareTableRowsRuntimeBuild);
assert.equal(current.visualOnly,false);
for(const previous of [last,old]){
  for(const field of ['base','deployment','baseSource','receiptStem',
    'uploadOperation','activationOperation','restoreOperation'])
    assert.notEqual(current[field],previous[field],'Spent WORK release reused: '+field);
}
const baseline={deployment:current.deployment,versions:[
  {id:current.base,percentage:100},{id:HQ_QUOTE,percentage:0},
]};
visualBaseline(baseline,current);
assert.throws(()=>visualBaseline({...baseline,deployment:last.deployment},current));
assert.throws(()=>visualBaseline({...baseline,versions:[
  {id:current.base,percentage:99},{id:HQ_QUOTE,percentage:1}]},current));
assert.throws(()=>visualBaseline({...baseline,versions:[
  {id:last.base,percentage:100},{id:HQ_QUOTE,percentage:0}]},current));
const attempt={
  candidate:'11111111-2222-4333-8444-555555555555',
  nonce:'22222222-3333-4444-8555-666666666666'};
const enabled={deployment:'33333333-4444-4555-8666-777777777777',
  message:current.activate+attempt.nonce,
  versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}]};
ownedVisualAllocation(enabled,attempt,current);
assert.throws(()=>ownedVisualAllocation({...enabled,message:'unexpected writer'},attempt,current));
ownedVisualAllocation({...enabled,message:current.restore+attempt.nonce,
  versions:baseline.versions},attempt,{...current,restored:true});
console.log('PASS WORK HQ compact table one-time release: exact active Archive/Search baseline, fresh receipts, unchanged 0% quote canary, owned restore and historical release isolation. OFFLINE.');
