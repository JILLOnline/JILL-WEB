// New reviewed navigation repair, separate receipts; prior releases stay spent.
import path from 'node:path';import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {checkWorkHqNavigationOnly} from './check-work-hq-navigation-only.mjs';
export const NAVIGATION_PROFILE=Object.freeze({
 base:'d301efb4-b015-40d4-87ad-159a9fff82eb',baseSource:'5815213b29999310ea44049ef99d20b5178948c5',
 deployment:'3fbc20ff-1f9e-4e70-8f14-3e941638347c',
 activate:'JILL HQ WORK navigation recovery activate ',restore:'JILL HQ WORK navigation recovery restore ',
 receiptStem:'work-hq-navigation-dashboard-v1',uploadOperation:'HQ_NAVIGATION_V1_INACTIVE_UPLOAD',
 activationOperation:'HQ_NAVIGATION_V1_ACTIVATE',restoreOperation:'HQ_NAVIGATION_V1_RESTORE',
 guard:checkWorkHqNavigationOnly,checkCommand:'work:hq:navigation:repair:check',testCommand:'test:work-hq-navigation-recovery',
 inspectCommand:'work:hq:navigation:repair:inspect',compiledTests:['test:workerd-navigation-local'],
 visualOnly:false,changeScope:'navigation_transport_and_authorized_dashboard',
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||!['--release-once','--inspect','--restore-once'].includes(process.argv[2])){
  console.error('STOP work_hq_navigation_explicit_mode_required');process.exitCode=1;
 }else await executeVisualRelease(process.argv[2],NAVIGATION_PROFILE);
}
