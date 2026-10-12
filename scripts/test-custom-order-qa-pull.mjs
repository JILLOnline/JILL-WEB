import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {
  qaDigest,reconstructCustomOrderQaSource,auditPulledCustomOrderQa,
  removeVerifiedStaleClaspJs,
} from './verify-custom-order-qa-remote.mjs';

const root=process.cwd();
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const historical=fs.readFileSync(
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const sheetId='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
const projection=reconstructCustomOrderQaSource(historical,commit,sheetId);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-custom-qa-pull-test-'));
const remote=path.join(tmp,'remote');
const local=path.join(tmp,'local');
fs.mkdirSync(remote);fs.mkdirSync(local);
const gs='JILL_Custom_Order_Automation_REWARDS.gs';
const js='JILL_Custom_Order_Automation_REWARDS.js';
const historicalReader=(sha)=>{assert.equal(sha,commit);return historical;};
const audit=()=>auditPulledCustomOrderQa({
  directory:remote,sheetId,gitReadAtSha:historicalReader,
});
try {
  assert.match(projection,/const JILL_CUSTOM_ORDER_SANDBOX = true;/);
  assert.match(projection,/const JILL_REWARDS_RUNTIME = 'WORK';/);
  assert.match(projection,/const JILL_REWARDS_BUILD_SHA = '[a-f0-9]{40}';/);
  assert.ok(!projection.includes('jillonlinestore.com'));
  assert.ok(!projection.includes('1xVG4Jvh-vLB6BH5QitNcLQuaLj6DkXeSlFHg_LkECT8'));
  // This is the exact clasp pull extension conversion shown on Windows:
  // .gs was pushed but .js was pulled. It is still one logical remote file.
  fs.writeFileSync(path.join(remote,js),projection.replace(/\n/g,'\r\n')+'\r\n');
  let verified=audit();
  assert.equal(verified.file,js);
  assert.equal(verified.commit,commit);
  assert.equal(verified.digest,qaDigest(projection));
  // Recover the file that the prior failed bootstrap left behind locally,
  // but only if it truly matches the audited Google remote.
  fs.writeFileSync(path.join(local,gs),projection);
  fs.writeFileSync(path.join(local,js),projection);
  assert.equal(removeVerifiedStaleClaspJs(local,verified),true);
  assert.deepEqual(fs.readdirSync(local),[gs]);
  assert.equal(removeVerifiedStaleClaspJs(local,verified),false);
  fs.writeFileSync(path.join(local,js),'// other edits');
  assert.throws(()=>removeVerifiedStaleClaspJs(local,verified),/differs from verified QA remote/);
  fs.rmSync(path.join(local,js));
  // Remote .gs is also a valid Google pull result.
  fs.renameSync(path.join(remote,js),path.join(remote,gs));
  verified=audit();
  assert.equal(verified.file,gs);
  // Reject unexpected files and ambiguous competing script sources.
  fs.writeFileSync(path.join(remote,'Code.js'),'function unexpected(){}');
  assert.throws(audit,/unknown or duplicate scripts/);
  fs.rmSync(path.join(remote,'Code.js'));
  fs.writeFileSync(path.join(remote,js),projection);
  assert.throws(audit,/unknown or duplicate scripts/);
  fs.rmSync(path.join(remote,js));
  // Reject a store/sheet mixup and unauthorized code drift.
  fs.writeFileSync(path.join(remote,gs),projection.replace(
    "SHEET_ID: '"+sheetId+"'","SHEET_ID: 'production'"));
  assert.throws(audit,/wrong runtime, spreadsheet or production scope/);
  fs.writeFileSync(path.join(remote,gs),projection.replace(
    "const JILL_CUSTOM_ORDER_SANDBOX = true;","const JILL_CUSTOM_ORDER_SANDBOX = false;"));
  assert.throws(audit,/wrong runtime, spreadsheet or production scope/);
  fs.writeFileSync(path.join(remote,gs),projection.replace(
    'JILL WORK Custom Orders QA online.','Externally modified response.'));
  assert.throws(audit,/differs from the certified Git build/);
  assert.throws(()=>reconstructCustomOrderQaSource(historical,commit,
    '1xVG4Jvh-vLB6BH5QitNcLQuaLj6DkXeSlFHg_LkECT8'),/Invalid historical QA source identity/);
  console.log('Clasp GS-to-JS round trip, certified Git provenance, stale recovery and remote-drift protections passed.');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
