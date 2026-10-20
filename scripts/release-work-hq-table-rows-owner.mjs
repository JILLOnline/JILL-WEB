// NEW one-time WORK HQ compact Requests rows presentation release.
// User's prior Archive/Search activation receipt is SPENT and remains immutable.
// This runner preserves existing bindings, backend routes and 0% quote canary.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {ARCHIVE_SEARCH_PROFILE} from './release-work-hq-archive-search-owner.mjs';
import {checkWorkHqTableRowsRuntime,prepareTableRowsRuntimeBuild}
  from './work-hq-table-rows-build.mjs';

export const TABLE_ROWS_PROFILE=Object.freeze({
  ...ARCHIVE_SEARCH_PROFILE,
  // Successful Owner Archive/Search v1 release readback, Oct 20 14:27:52Z.
  // Every new attempt MUST re-read and match exact Cloudflare state.
  base:'ecf3bfd8-091a-4ef4-ae84-ad58c61ee92a',
  deployment:'5eaa3555-b7b5-4011-a180-fa430b247427',
  baseSource:'1adbdeb6e469cfd74f4d47a2aef29a5fbfe36b87',
  activate:'JILL HQ WORK Compact request rows v1 activate ',
  restore:'JILL HQ WORK Compact request rows v1 restore ',
  receiptStem:'work-hq-compact-rows-v1',
  uploadOperation:'HQ_COMPACT_ROWS_V1_INACTIVE_UPLOAD',
  activationOperation:'HQ_COMPACT_ROWS_V1_ACTIVATE',
  restoreOperation:'HQ_COMPACT_ROWS_V1_RESTORE',
  visualOnly:false,
  changeScope:'frozen_twenty_file_hq_compact_rows_no_schema_or_backend_mutation',
  guard:checkWorkHqTableRowsRuntime,
  prepareBuild:prepareTableRowsRuntimeBuild,
  checkCommand:'work:hq:table-rows:runtime:check',
  testCommand:'test:work-hq-table-rows-release',
  inspectCommand:'work:hq:table-rows:inspect',
  compiledTests:['test:workerd-navigation-local'],
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||
     !['--inspect','--release-once','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_compact_rows_explicit_mode_required');
    process.exitCode=1;
  }else await executeVisualRelease(process.argv[2],TABLE_ROWS_PROFILE);
}
