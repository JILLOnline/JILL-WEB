import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {
  auditWorkQaReadOnly,verifyLocalWorkQaIdentity,runReadOnlyClasp,publishedVersionFromClasp,
} from './audit-work-qa-script-readonly.mjs';
import {reconstructCustomOrderQaSource} from './verify-custom-order-qa-remote.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'jill-qa-read-audit-test-'));
const dir=path.join(root,'.work-custom-orders');
fs.mkdirSync(dir);
const scriptId='10Wnf8JaV1mUnXcGiO59UO7u_X8JKI3JJx_kqfE3S16rpvjAzgPBqhf0r';
const sheetId='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
const deployment='AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V';
const record={scriptId,sheetId,shop:'jill-work.myshopify.com',
  origin:'separate Custom Order QA clasp create-script'};
const recordPath=path.join(dir,'.qa-project.json');
const claspPath=path.join(dir,'.clasp.json');
fs.writeFileSync(recordPath,JSON.stringify(record));
fs.writeFileSync(claspPath,JSON.stringify({scriptId}));
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const canonical=fs.readFileSync(
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const compiled=reconstructCustomOrderQaSource(canonical,sha,sheetId);
const invoked=[];
const run=(cwd,cmd,options={})=>{
  invoked.push([cmd,options.versionNumber??null]);
  if(cmd==='list-deployments')return deployment+' @7 - WORK QA';
  assert.equal(cmd,'pull');
  fs.writeFileSync(path.join(cwd,'JILL_Custom_Order_Automation_REWARDS.js'),compiled);
  return 'Pulled WORK QA project source';
};
try {
  assert.equal(verifyLocalWorkQaIdentity(root).scriptId,scriptId);
  const before=fs.readdirSync(dir).sort();
  const res=await auditWorkQaReadOnly({
    root,invokeClasp:run,
    readHistorical:commit=>{
      assert.equal(commit,sha);
      return canonical;
    },
  });
  assert.equal(res.deploymentFound,true);
  assert.equal(res.headMatchesCertifiedGit,true);
  assert.equal(res.publishedRevisionVerified,true);
  assert.equal(res.publishedVersion,7);
  assert.equal(res.publishedCommit,sha);
  assert.equal(res.publishedDigest,res.sourceDigest);
  assert.equal(res.historicalCommit,sha);
  assert.deepEqual(invoked,[['list-deployments',null],['pull',null],['pull',7]]);
  assert.deepEqual(fs.readdirSync(dir).sort(),before,
    'Remote audit must never change existing source workspace');

  await assert.rejects(()=>auditWorkQaReadOnly({
    root,readHistorical:()=>canonical,
    invokeClasp:()=>'- wrong deployment',
  }),/Expected exactly one WORK QA deployment/);

  await assert.rejects(()=>auditWorkQaReadOnly({
    root,readHistorical:()=>canonical,
    invokeClasp:(cwd,cmd)=>{
      if(cmd==='list-deployments')return deployment+' @7 - WORK QA';
      fs.writeFileSync(path.join(cwd,'JILL_Custom_Order_Automation_REWARDS.js'),
        compiled.replace('JILL WORK Custom Orders QA online.',
                         'Unexpected unauthorized source change.'));
      return 'pulled';
    },
  }),/differs from the certified Git build/);

  for(const invalid of [deployment,deployment+' @HEAD',deployment+' @0',deployment+' @7\n'+deployment+' @8']) {
    assert.throws(()=>publishedVersionFromClasp(invalid),/version|exactly one/);
  }
  fs.writeFileSync(recordPath,JSON.stringify({...record,shop:'jqtdgr-1y.myshopify.com'}));
  await assert.rejects(()=>auditWorkQaReadOnly({
    root,invokeClasp:()=>{throw Error('Remote call must not occur');},
  }),/project identity mismatch/);
  assert.throws(()=>runReadOnlyClasp(root,'push'),/Only.*read-only/);
  assert.throws(()=>runReadOnlyClasp(root,'update-deployment'),/Only.*read-only/);
  assert.throws(()=>runReadOnlyClasp(root,'pull',{versionNumber:0}),/Only.*read-only/);
  assert.throws(()=>runReadOnlyClasp(root,'pull',{versionNumber:'7'}),/Only.*read-only/);
  console.log('PASS WORK QA audit: independently certified project HEAD and immutable published /exec version, no remote writes, exact project, source tamper and LIVE denial.');
} finally {
  fs.rmSync(root,{recursive:true,force:true});
}
