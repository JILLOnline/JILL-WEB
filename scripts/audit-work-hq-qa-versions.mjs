// Inspect Google QA HEAD and both known published /exec versions.
// READ ONLY: temporary clasp pull; no push, deploy, PropertiesService writes,
// credential input, request submissions, status mutations or remote changes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {
  runReadOnlyClasp,verifyLocalWorkQaIdentity,
} from './audit-work-qa-script-readonly.mjs';
import {auditPulledCustomOrderQa}
  from './verify-custom-order-qa-remote.mjs';

const SCRIPT_ID='10Wnf8JaV1mUnXcGiO59UO7u_X8JKI3JJx_kqfE3S16rpvjAzgPBqhf0r';
const WORK_SHEET='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
const PUBLISHED_QA='AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V';
const NEW_HQ='AKfycby6C2Y2HMZB-vHyAikK-X8hrHhoXFSx-iU0o3w2qj4iO9J1jzo4P1rBJ7z3uqXkEvCN';
const REQUIRED_SCOPES=[
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
];
const REQUIRED_FEATURES=Object.freeze([
  ['write_route',/jill_order_merchant_command[\s\S]{0,140}jillWorkHqMerchantCommand_/],
  ['signed_write_verifier',/function jillWorkHqMerchantCommandVerified_\(/],
  ['write_preflight',/function jillWorkHqQaWritePreflight\(/],
  ['canonical_event_writer',/function jillCustomOrderMerchantUpdateAsActor_\(/],
  ['qa_source_cache',/const JILL_WORK_HQ_CACHE_SECONDS=15;/],
  ['email_outbox_queued_only',/function jillWorkHqQueueEmail_\(/],
]);
export function publishedVersion(text,id) {
  if(typeof text!=='string'||typeof id!=='string')throw Error('invalid_deployment_list');
  const lines=text.split(/\r?\n/).filter(line=>line.includes(id));
  if(lines.length!==1)throw Error('missing_or_ambiguous_qa_deployment');
  const tail=lines[0].slice(lines[0].indexOf(id)+id.length);
  const match=tail.match(/^\s+@([1-9][0-9]*)\b/);
  if(!match)throw Error('invalid_published_version');
  const number=Number(match[1]);
  if(!Number.isSafeInteger(number))throw Error('invalid_published_version');
  return number;
}
export function inspectWorkQaSource(source,manifest) {
  if(typeof source!=='string'||!manifest||typeof manifest!=='object')
    throw Error('invalid_qa_source');
  if(!source.includes("const JILL_REWARDS_RUNTIME = 'WORK';") ||
     !source.includes('const JILL_CUSTOM_ORDER_SANDBOX = true;') ||
     !source.includes("SHEET_ID: '"+WORK_SHEET+"'")||
     source.includes('jillonlinestore.com')||
     source.includes('jqtdgr-1y.myshopify.com'))
    throw Error('wrong_qa_scope');
  const scopes=manifest.oauthScopes;
  if(!Array.isArray(scopes)||scopes.length!==REQUIRED_SCOPES.length||
    !REQUIRED_SCOPES.every(scope=>scopes.includes(scope))||
    manifest.webapp?.access!=='ANYONE_ANONYMOUS'||
    manifest.webapp?.executeAs!=='USER_DEPLOYING')
    throw Error('qa_manifest_scope_drift');
  return Object.fromEntries(REQUIRED_FEATURES.map(
    ([feature,pattern])=>[feature,pattern.test(source)]
  ));
}
export async function auditWorkHqQaVersions({
  root=process.cwd(),invokeClasp=runReadOnlyClasp,
  readHistorical=sha=>execFileSync('git',[
    '-C',root,'show',sha+':backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs',
  ],{encoding:'utf8',maxBuffer:8*1024*1024}),
}={}) {
  if(typeof invokeClasp!=='function'||typeof readHistorical!=='function')
    throw Error('invalid_audit_adapters');
  const identity=verifyLocalWorkQaIdentity(root);
  if(identity.scriptId!==SCRIPT_ID||identity.sheetId!==WORK_SHEET)
    throw Error('work_qa_identity_mismatch');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-hq-qa-version-audit-'));
  const createDir=name=>{
    const dest=path.join(tmp,name);
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest,'.clasp.json'),
      JSON.stringify({scriptId:SCRIPT_ID})+'\n');
    return dest;
  };
  try{
    const dir=createDir('list');
    const listing=invokeClasp(dir,'list-deployments');
    const versions={
      pinned:publishedVersion(listing,PUBLISHED_QA),
      extra:publishedVersion(listing,NEW_HQ),
    };
    const results={};
    for(const [name,version] of [
      ['editor_head',undefined],
      ['pinned_work_qa',versions.pinned],
      ['new_hq_r_w',versions.extra],
    ]) {
      const target=createDir(name);
      if(version===undefined)invokeClasp(target,'pull');
      else invokeClasp(target,'pull',{versionNumber:version});
      const verified=auditPulledCustomOrderQa({
        directory:target,sheetId:WORK_SHEET,gitReadAtSha:readHistorical,
      });
      const source=fs.readFileSync(path.join(target,verified.file),'utf8');
      const manifest=JSON.parse(fs.readFileSync(
        path.join(target,'appsscript.json'),'utf8'));
      const features=inspectWorkQaSource(source,manifest);
      results[name]=Object.freeze({
        version:version??'HEAD',commit:verified.commit,
        features,write_ready_source:Object.values(features).every(Boolean),
      });
    }
    return Object.freeze(results);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    const root=process.cwd();
    const branch=execFileSync('git',['-C',root,'branch','--show-current'],
      {encoding:'utf8'}).trim();
    const head=execFileSync('git',['-C',root,'rev-parse','HEAD'],
      {encoding:'utf8'}).trim();
    const remote=execFileSync('git',['-C',root,'rev-parse',
      'refs/remotes/origin/jill/rewards-work'],{encoding:'utf8'}).trim();
    if(branch!=='jill/rewards-work'||head!==remote)
      throw Error('work_source_not_synced');
    const result=await auditWorkHqQaVersions({root});
    for(const [name,item] of Object.entries(result)){
      console.log(name+' @'+item.version+' | certified Git '+item.commit.slice(0,12)+
        ' | write source complete: '+item.write_ready_source);
      if(!item.write_ready_source){
        const missing=Object.entries(item.features)
          .filter(([,present])=>!present).map(([feature])=>feature);
        console.log('  missing: '+missing.join(', '));
      }
    }
    if(result.editor_head.write_ready_source&&result.new_hq_r_w.write_ready_source)
      console.log('PASS HEAD and JILL HQ R/W contain reviewed WORK write features.');
    else
      console.log('STOP write activation: selected QA code snapshot lacks required features.');
    console.log('Read-only: no Google deployment, secrets, records or LIVE modified.');
  }catch(error){
    const allowed=new Set([
      'work_source_not_synced','work_qa_identity_mismatch',
      'missing_or_ambiguous_qa_deployment','invalid_published_version',
      'invalid_qa_source','wrong_qa_scope','qa_manifest_scope_drift',
    ]);
    console.error('WORK HQ QA version audit STOPPED: '+
      (allowed.has(error?.message)?error.message:'source_or_login_verification_failed'));
    process.exitCode=1;
  }
}
