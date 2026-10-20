// Reviewed request presentation and explicit on-open query only. No provider calls.
import fs from 'node:fs';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {DENSITY_FILES,DENSITY_RUNTIME_BASE,prepareReviewedPresentationBuild} from './work-hq-density-package.mjs';
import {studioDigest} from './check-work-hq-studio-only.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),APP='services/jill-order-desk/app-home';
export const ORDER_DETAILS_SOURCE='5fa3b1fb6e7d859d9840fb6329150f7fa44a1aae';
export const ORDER_DETAILS_FILES=Object.freeze([...DENSITY_FILES,APP+'/app/routes/app.requests.tsx',APP+'/app/routes/app.requests.$submissionId.tsx',APP+'/app/components/WorkOriginalRequestDetails.tsx']);
const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export const orderDetailsManifest=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/work-hq-order-details-reviewed.json'),'utf8'));
export function checkWorkHqOrderDetails(){
 assert.equal(git('branch','--show-current'),'jill/rewards-work');
 const m=orderDetailsManifest();assert.equal(m.source_baseline,ORDER_DETAILS_SOURCE);assert.equal(m.runtime_baseline,DENSITY_RUNTIME_BASE);
 assert.deepEqual(Object.keys(m.files).sort(),[...ORDER_DETAILS_FILES].sort());
 assert.equal(git('diff','--name-only',ORDER_DETAILS_SOURCE,'--','backend','extensions','theme','services'),'','Runtime source changed after Order details review');
 for(const [file,hash] of Object.entries(m.files)){
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');assert.equal(studioDigest(source),hash,'Reviewed request UI differs: '+file);
  if(file.endsWith('.css'))assert(!/!important|\bzoom\s*:|scale\(|\.Polaris|::part\(/i.test(source));
 }
 return {runtime_scope:'reviewed_request_presentation_and_on_open_read',reviewed_files:ORDER_DETAILS_FILES.length,
  new_backend_endpoints:0,server_auth_cache_and_commands_unchanged:true,unreleased_quote_business_work_excluded:true};
}
export function prepareOrderDetailsBuild({runner}={}){
 return prepareReviewedPresentationBuild({runner,manifest:orderDetailsManifest(),guard:checkWorkHqOrderDetails,prefix:'order-details-package-'});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(checkWorkHqOrderDetails(),null,2));
