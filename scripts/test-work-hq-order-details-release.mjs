import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {ORDER_DETAILS_PROFILE as p} from './release-work-hq-order-details-owner.mjs';
import {orderDetailsManifest,ORDER_DETAILS_FILES,checkWorkHqOrderDetails,prepareOrderDetailsBuild} from './work-hq-order-details-package.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {visualBaseline,ownedVisualAllocation} from './release-work-hq-visual-theme-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';
assert.deepEqual(Object.keys(orderDetailsManifest().files).sort(),[...ORDER_DETAILS_FILES].sort());
assert.equal(ORDER_DETAILS_FILES.length,10);assert.equal(p.visualOnly,false);assert.equal(p.receiptStem,'work-hq-order-details-v1');
const before={deployment:p.deployment,versions:[{id:p.base,percentage:100},{id:HQ_QUOTE,percentage:0}]};visualBaseline(before,p);
for(const edit of [{deployment:'00000000-0000-4000-8000-000000000000'},{versions:[{id:p.base,percentage:100}]},{versions:[{id:p.base,percentage:99},{id:HQ_QUOTE,percentage:1}]}])assert.throws(()=>visualBaseline({...before,...edit},p));
const attempt={candidate:'11111111-2222-4333-8444-555555555555',nonce:'22222222-3333-4444-8555-666666666666'};
const owned={deployment:'33333333-4444-4555-8666-777777777777',message:p.activate+attempt.nonce,versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}]};
ownedVisualAllocation(owned,attempt,p);assert.throws(()=>ownedVisualAllocation({...owned,message:'another release'},attempt,p));
ownedVisualAllocation({...owned,message:p.restore+attempt.nonce,versions:before.versions},attempt,{...p,restored:true});
assert.notEqual(p.receiptStem,'work-hq-compact-theme-v1');
if(process.argv.includes('--package-local')){
 checkWorkHqOrderDetails();const runner=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const app=prepareOrderDetailsBuild({runner}),root=app.slice(0,-'services/jill-order-desk/app-home'.length);
 for(const file of ['backend/jill-merchant-policy.mjs','services/jill-order-desk/work-quote-agreement.mjs'])assert.deepEqual(fs.readFileSync(root+file),execFileSync('git',['show',DENSITY_RUNTIME_BASE+':'+file]));
 assert.equal(fs.existsSync(root+'services/jill-order-desk/work-quote-calculation.mjs'),false);
 assert(!fs.existsSync(app+'/.dev.vars'));assert(!fs.existsSync(root+'/.git'));
 fs.writeFileSync('services/jill-order-desk/app-home/.wrangler/density-review/order-release-app.txt',app);
 console.log('PASS actual isolated Order details package: ten exact UI files, runtime business source retained, deferred quote code/credentials excluded.');
}
console.log('PASS new Order details release: exact current WORK baseline, retained 0% quote canary, changed/allocation-owner denial, owned restoration and unique receipts.');
