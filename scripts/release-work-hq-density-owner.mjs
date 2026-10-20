// NEW WORK density edition. Every earlier upload/activation receipt stays spent.
import path from 'node:path';import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {checkWorkHqDensity,prepareDensityBuild,DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
export const DENSITY_PROFILE=Object.freeze({
 base:'6473444f-86f8-4a83-a47a-56d1a2e19f05',baseSource:DENSITY_RUNTIME_BASE,
 deployment:'1ffdde49-e556-43a6-b7bb-e10cd3a71048',
 activate:'JILL HQ WORK compact theme activate ',restore:'JILL HQ WORK compact theme restore ',
 receiptStem:'work-hq-compact-theme-v1',uploadOperation:'HQ_COMPACT_V1_INACTIVE_UPLOAD',
 activationOperation:'HQ_COMPACT_V1_ACTIVATE',restoreOperation:'HQ_COMPACT_V1_RESTORE',
 guard:checkWorkHqDensity,prepareBuild:prepareDensityBuild,
 checkCommand:'work:hq:compact:check',testCommand:'test:work-hq-compact',inspectCommand:'work:hq:compact:inspect',
 compiledTests:['test:workerd-navigation-local'],
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||!['--release-once','--inspect','--restore-once'].includes(process.argv[2])){
  console.error('STOP work_hq_visual_explicit_mode_required');process.exitCode=1;
 }else await executeVisualRelease(process.argv[2],DENSITY_PROFILE);
}
