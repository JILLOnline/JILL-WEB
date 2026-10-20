// One-use WORK HQ Requests row disclosure release. Current verified active
// connected Catalog/access baseline; only four reviewed React/CSS files differ.
// Never run previous release receipts, migrations, Shopify extension deploy,
// quote/messaging activation, paid services or LIVE promotion.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {TABLE_ROWS_PROFILE} from './release-work-hq-table-rows-owner.mjs';
import {reviewedRowRuntime,prepareRowDisclosureBuild}
  from './work-hq-row-disclosure-runtime-build.mjs';

export const ROW_DISCLOSURE_PROFILE=Object.freeze({
  ...TABLE_ROWS_PROFILE,
  // Owner inventory 2026-10-20T18:17Z; Wrangler viewed exact version.
  base:'f224e8f5-3919-45e3-8fb6-bf85f6e482f5',
  deployment:'eb8c1ed6-2f03-4f9e-b0da-9b865ecb2bae',
  baseSource:'e286e751a8c4e8345b89201fee167a43c5fd398f',
  activate:'JILL HQ WORK Requests row disclosure v1 activate ',
  restore:'JILL HQ WORK Requests row disclosure v1 restore ',
  receiptStem:'work-hq-row-disclosure-v1',
  uploadOperation:'HQ_ROW_DISCLOSURE_V1_INACTIVE_UPLOAD',
  activationOperation:'HQ_ROW_DISCLOSURE_V1_ACTIVATE',
  restoreOperation:'HQ_ROW_DISCLOSURE_V1_RESTORE',
  visualOnly:false,
  changeScope:'frozen_twenty_file_runtime_only_four_reviewed_requests_ui_files_changed',
  guard:reviewedRowRuntime,
  prepareBuild:prepareRowDisclosureBuild,
  checkCommand:'work:hq:row-disclosure:runtime:check',
  testCommand:'test:work-hq-row-disclosure-release',
  inspectCommand:'work:hq:row-disclosure:inspect',
  compiledTests:['test:workerd-navigation-local'],
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||
    !['--inspect','--release-once','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_row_disclosure_explicit_mode_required');
    process.exitCode=1;
  }else await executeVisualRelease(process.argv[2],ROW_DISCLOSURE_PROFILE);
}
