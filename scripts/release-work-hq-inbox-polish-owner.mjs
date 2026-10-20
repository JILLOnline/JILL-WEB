// Dedicated unused WORK HQ inbox polish release; never reuse Order details/compact receipts.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {ORDER_DETAILS_PROFILE} from './release-work-hq-order-details-owner.mjs';
import {checkWorkHqInboxPolish,prepareInboxPolishBuild} from './work-hq-inbox-polish-package.mjs';

export const INBOX_POLISH_PROFILE=Object.freeze({
  ...ORDER_DETAILS_PROFILE,
  // Verified Owner Wrangler read-back, 2026-10-20 03:03Z.
  // This supersedes the earlier Order details *pre*-activation baseline.
  base:'e5a26304-841a-472b-a128-4c7c8eacfd78',
  baseSource:'58a76f09bd442e0d74f1b0a07e93fa1e914690ac',
  deployment:'9bee2d79-3992-4c7d-8577-7828ad4c1b59',
  activate:'JILL HQ WORK Inbox polish v1 activate ',
  restore:'JILL HQ WORK Inbox polish v1 restore ',
  receiptStem:'work-hq-inbox-polish-v1',
  uploadOperation:'HQ_INBOX_POLISH_V1_INACTIVE_UPLOAD',
  activationOperation:'HQ_INBOX_POLISH_V1_ACTIVATE',
  restoreOperation:'HQ_INBOX_POLISH_V1_RESTORE',
  visualOnly:false,
  changeScope:'frozen_eleven_file_request_presentation_and_on_open_read',
  guard:checkWorkHqInboxPolish,
  prepareBuild:prepareInboxPolishBuild,
  checkCommand:'work:hq:inbox-polish:check',
  testCommand:'test:work-hq-inbox-polish-release',
  inspectCommand:'work:hq:inbox-polish:inspect',
  compiledTests:['test:workerd-navigation-local'],
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||
     !['--release-once','--inspect','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_inbox_polish_explicit_mode_required');
    process.exitCode=1;
  }else await executeVisualRelease(process.argv[2],INBOX_POLISH_PROFILE);
}
