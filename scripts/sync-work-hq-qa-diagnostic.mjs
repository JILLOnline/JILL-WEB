// Update only the isolated WORK QA project editor HEAD. Never update /exec.
// Required for the Apps Script Run menu to expose the canonical, read-only
// jillWorkHqQaReadDiagnostic function (private trailing-underscore helpers
// intentionally do not appear in the editor menu).
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {auditWorkQaReadOnly} from './audit-work-qa-script-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const WORK_SHEET='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
function git(...args) {
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
if(git('branch','--show-current')!=='jill/rewards-work')
  throw Error('WORK QA diagnostic sync requires jill/rewards-work.');
if(git('status','--porcelain','--untracked-files=no'))
  throw Error('Tracked changes present. Refusing Google QA source update.');
if(git('rev-parse','HEAD')!==git('rev-parse','refs/remotes/origin/jill/rewards-work'))
  throw Error('WORK Git source differs from local origin. Pull first.');
const environment={
  ...process.env,
  JILL_CUSTOM_ORDER_WORK_SHEET_ID:WORK_SHEET,
};
console.log('Updating only the certified isolated WORK QA script editor HEAD.');
console.log('Existing published /exec version will NOT be updated.');
execFileSync(process.execPath,['scripts/bootstrap-custom-order-work-backend.mjs'],{
  cwd:ROOT,env:environment,stdio:'inherit',
});
const checked=await auditWorkQaReadOnly({root:ROOT});
if(!checked.publishedRevisionVerified ||
   checked.historicalCommit!==git('rev-parse','HEAD'))
  throw Error('WORK QA editor source verification failed. No /exec deployment attempted.');
console.log('PASS Google WORK QA editor HEAD matches new certified Git.');
console.log('PASS /exec version '+checked.publishedVersion+
  ' remains separately certified and unchanged.');
console.log('Refresh Apps Script Editor and select jillWorkHqQaReadDiagnostic.');
console.log('No spreadsheet writes, Google deployment, Cloudflare or LIVE changes.');
