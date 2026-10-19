// New visual edition, separate unused receipts; v1 receipts remain spent.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {checkWorkHqStudioOnly} from './check-work-hq-studio-only.mjs';
export const STUDIO_PROFILE=Object.freeze({
 base:'80b47610-4d8a-4186-a4c8-fe4f05daf964',
 baseSource:'9a92d0287e69628c63bd7bec9a5e3dace63f1c94',
 deployment:'dc3350e2-c394-4a5f-9d48-325ed23a1394',
 activate:'JILL HQ WORK visual theme v2 activate ',restore:'JILL HQ WORK visual theme v2 restore ',
 receiptStem:'work-hq-visual-theme-v2',
 uploadOperation:'HQ_VISUAL_V2_INACTIVE_UPLOAD',activationOperation:'HQ_VISUAL_V2_ACTIVATE',restoreOperation:'HQ_VISUAL_V2_RESTORE',
 guard:checkWorkHqStudioOnly,checkCommand:'work:hq:studio:check',testCommand:'test:work-hq-studio',inspectCommand:'work:hq:studio:inspect',
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||!['--release-once','--inspect','--restore-once'].includes(process.argv[2])){
  console.error('STOP work_hq_visual_explicit_mode_required');process.exitCode=1;
 }else await executeVisualRelease(process.argv[2],STUDIO_PROFILE);
}
