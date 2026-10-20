// NEW one-use WORK HQ centered Quick Actions disclosure release.
// Previous inbox polish and Order details receipts are SPENT and remain untouched.
// Cloudflare uploads/deploys are Owner-only and require the exact active baseline.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {INBOX_POLISH_PROFILE} from './release-work-hq-inbox-polish-owner.mjs';
import {checkWorkHqQuickPill,prepareQuickPillBuild} from './work-hq-quick-pill-package.mjs';

export const QUICK_PILL_PROFILE=Object.freeze({
  ...INBOX_POLISH_PROFILE,
  // Owner inventory 2026-10-20 03:30:29Z: exact 100% WORK active and 0% quote.
  base:'9dd60e19-9c77-4886-9c7e-56589ac0b401',
  deployment:'6cdff6bd-6743-4156-aaed-e874f2b3d914',
  // Release source expected from previous guarded inbox-polish activation.
  // The current version's Cloudflare annotation MUST prove this exact SHA,
  // using inspectConnectedVersion BEFORE uploading anything; fail closed otherwise.
  baseSource:'4aee2c15603f4e6b6165eb5fe2168c1b24dd39df',
  activate:'JILL HQ WORK Quick pill v1 activate ',
  restore:'JILL HQ WORK Quick pill v1 restore ',
  receiptStem:'work-hq-quick-pill-v1',
  uploadOperation:'HQ_QUICK_PILL_V1_INACTIVE_UPLOAD',
  activationOperation:'HQ_QUICK_PILL_V1_ACTIVATE',
  restoreOperation:'HQ_QUICK_PILL_V1_RESTORE',
  visualOnly:false,
  changeScope:'frozen_centered_quick_actions_disclosure_plus_existing_on_open_read',
  guard:checkWorkHqQuickPill,
  prepareBuild:prepareQuickPillBuild,
  checkCommand:'work:hq:quick-pill:check',
  testCommand:'test:work-hq-quick-pill-release',
  inspectCommand:'work:hq:quick-pill:inspect',
  compiledTests:['test:workerd-navigation-local'],
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||
     !['--release-once','--inspect','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_quick_pill_explicit_mode_required');
    process.exitCode=1;
  }else await executeVisualRelease(process.argv[2],QUICK_PILL_PROFILE);
}
