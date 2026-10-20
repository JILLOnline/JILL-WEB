// One-use HQ WORK Archive/Search release. Source includes reviewed server
// routes and helpers; the SQL proposal remains OFF and archive writes gated.
// All older presentation receipt namespaces remain forever spent.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {WORKSPACE_LAYOUT_PROFILE} from './release-work-hq-workspace-layout-owner.mjs';
import {checkWorkHqArchiveSearchRuntime,prepareArchiveSearchRuntimeBuild}
  from './work-hq-archive-search-build.mjs';

export const ARCHIVE_SEARCH_PROFILE=Object.freeze({
  ...WORKSPACE_LAYOUT_PROFILE,
  // Owner Wrangler readback 2026-10-20T14:13:41Z.
  base:'66738e55-4890-4be1-868d-cc9dde19798d',
  deployment:'d3df60a1-b715-48e7-a557-cb5af1fda868',
  baseSource:'782d866944ca9cdef0220fba254f6cd0a30e865a',
  activate:'JILL HQ WORK Archive search v1 activate ',
  restore:'JILL HQ WORK Archive search v1 restore ',
  receiptStem:'work-hq-archive-search-v1',
  uploadOperation:'HQ_ARCHIVE_SEARCH_V1_INACTIVE_UPLOAD',
  activationOperation:'HQ_ARCHIVE_SEARCH_V1_ACTIVATE',
  restoreOperation:'HQ_ARCHIVE_SEARCH_V1_RESTORE',
  visualOnly:false,
  changeScope:'reviewed_twenty_file_archive_search_server_and_ui_no_schema',
  guard:checkWorkHqArchiveSearchRuntime,
  prepareBuild:prepareArchiveSearchRuntimeBuild,
  checkCommand:'work:hq:archive-search:runtime:check',
  testCommand:'test:work-hq-archive-search-release',
  inspectCommand:'work:hq:archive-search:inspect',
  compiledTests:['test:workerd-navigation-local'],
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||
    !['--inspect','--release-once','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_archive_search_explicit_mode_required');
    process.exitCode=1;
  }else await executeVisualRelease(process.argv[2],ARCHIVE_SEARCH_PROFILE);
}
