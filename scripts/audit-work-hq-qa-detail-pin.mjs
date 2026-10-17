// READ-ONLY WORK v9 pin certification. No secrets, record reads or deploys.
// Match the hard-pinned full-detail reader to the certified live Google QA
// deployment listing, without modifying the existing v7 merchant list source.
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {reconcileWorkQaDetailRemote}
  from './reconcile-work-hq-qa-detail-deployment.mjs';
import {detailProbeEndpoint}
  from './probe-work-hq-qa-detail-v9.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL}
  from '../services/jill-order-desk/work-google-merchant-detail.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
function stop(code){throw Error(code);}

export function verifyWorkQaDetailSourcePin({
  deploymentId,version,detailUrl=JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL,
  listUrl=JILL_HQ_WORK_QA_GOOGLE_URL,
}={}) {
  const certified=detailProbeEndpoint(deploymentId,version);
  if(detailUrl!==certified || detailUrl===listUrl)
    stop('work_detail_v9_pin_mismatch');
  return Object.freeze({verified:true,version,legacyListPreserved:true});
}
function git(...args) {
  return execFileSync('git',['-C',ROOT,...args],
    {encoding:'utf8'}).trim();
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked) {
  try {
    if(process.argv.length!==2 ||
       git('branch','--show-current')!=='jill/rewards-work' ||
       git('rev-parse','HEAD')!==
         git('rev-parse','refs/remotes/origin/jill/rewards-work') ||
       git('status','--porcelain','--untracked-files=no'))
      stop('work_source_not_synced');
    const listed=await reconcileWorkQaDetailRemote({root:ROOT});
    if(listed.state!=='present_unprobed')
      stop('work_detail_v9_deployment_missing');
    const proof=verifyWorkQaDetailSourcePin({
      deploymentId:listed.deploymentId,version:listed.version,
    });
    if(!proof.verified)stop('work_detail_v9_pin_mismatch');
    console.log('PASS dedicated WORK exact-detail pin matches Google deployment @9.');
    console.log('PASS legacy WORK QA list/status source remains on original v7 URL.');
    console.log('READ ONLY: no Google, Cloudflare, Shopify, D1, secret, record, LIVE or KEEP changes.');
    console.log('Detail Worker feature remains OFF; next validate an inactive WORK canary build.');
  } catch(e) {
    const allowed=new Set([
      'work_source_not_synced','work_detail_v9_deployment_missing',
      'work_detail_v9_pin_mismatch','uncertified_qa_detail_deployment',
    ]);
    console.error('WORK HQ detail source PIN AUDIT STOPPED: '+
      (allowed.has(e?.message)?e.message:'read_only_pin_certification_failed'));
    process.exitCode=1;
  }
}
