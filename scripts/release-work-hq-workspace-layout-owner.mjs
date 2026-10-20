// One-use WORK HQ request-workspace visual release. Prior receipts remain spent.
// Exact current Cloudflare allocation and source annotation verified by Owner
// read-only inventory on 2026-10-20T12:43Z. Never touch LIVE or quote canary.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {QUICK_PILL_PROFILE} from './release-work-hq-quick-pill-owner.mjs';
import {checkWorkHqWorkspaceLayoutDraft,prepareWorkspaceLayoutDraft}
  from './work-hq-workspace-layout-draft.mjs';

export const WORKSPACE_LAYOUT_PROFILE=Object.freeze({
  ...QUICK_PILL_PROFILE,
  base:'389a3378-833e-438c-ad55-d71e2238dded',
  deployment:'3f52ee4b-414e-499a-8854-b89c7a7fb610',
  baseSource:'b3992cb7f747cb1ae9816c7c6244653ea2dbe2b7',
  activate:'JILL HQ WORK Workspace layout v1 activate ',
  restore:'JILL HQ WORK Workspace layout v1 restore ',
  receiptStem:'work-hq-workspace-layout-v1',
  uploadOperation:'HQ_WORKSPACE_LAYOUT_V1_INACTIVE_UPLOAD',
  activationOperation:'HQ_WORKSPACE_LAYOUT_V1_ACTIVATE',
  restoreOperation:'HQ_WORKSPACE_LAYOUT_V1_RESTORE',
  visualOnly:false,
  changeScope:'frozen_thirteen_file_hq_request_workspace_and_accordion_presentation',
  guard:checkWorkHqWorkspaceLayoutDraft,
  prepareBuild:prepareWorkspaceLayoutDraft,
  checkCommand:'work:hq:workspace-layout:check',
  testCommand:'test:work-hq-workspace-layout-release',
  inspectCommand:'work:hq:workspace-layout:inspect',
  compiledTests:['test:workerd-navigation-local'],
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||
     !['--inspect','--release-once','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_workspace_layout_explicit_mode_required');
    process.exitCode=1;
  }else await executeVisualRelease(process.argv[2],WORKSPACE_LAYOUT_PROFILE);
}
