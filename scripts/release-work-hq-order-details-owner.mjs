// NEW one-use WORK request overview release. Historical receipts stay spent.
import path from 'node:path';import {pathToFileURL} from 'node:url';
import {executeVisualRelease} from './release-work-hq-visual-theme-owner.mjs';
import {checkWorkHqOrderDetails,prepareOrderDetailsBuild} from './work-hq-order-details-package.mjs';
export const ORDER_DETAILS_PROFILE=Object.freeze({
 base:'f9830ddf-4ff7-4e24-896e-3618ee5686d7',baseSource:'a3b0c82e26030c7df6ae5ec9bf7af0c96e5da48d',
 deployment:'a67cfa4f-cea0-4590-b0b7-10f6f17acebc',
 activate:'JILL HQ WORK Order details activate ',restore:'JILL HQ WORK Order details restore ',
 receiptStem:'work-hq-order-details-v1',uploadOperation:'HQ_ORDER_DETAILS_V1_INACTIVE_UPLOAD',
 activationOperation:'HQ_ORDER_DETAILS_V1_ACTIVATE',restoreOperation:'HQ_ORDER_DETAILS_V1_RESTORE',
 visualOnly:false,changeScope:'request_presentation_and_explicit_on_open_read',
 guard:checkWorkHqOrderDetails,prepareBuild:prepareOrderDetailsBuild,
 checkCommand:'work:hq:order-details:check',testCommand:'test:work-hq-order-details-release',inspectCommand:'work:hq:order-details:inspect',
 compiledTests:['test:workerd-navigation-local'],
});
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||!['--release-once','--inspect','--restore-once'].includes(process.argv[2])){
  console.error('STOP work_hq_visual_explicit_mode_required');process.exitCode=1;
 }else await executeVisualRelease(process.argv[2],ORDER_DETAILS_PROFILE);
}
