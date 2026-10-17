// Phase 30: validate actual built WORK canary config in CI or locally.
// No provider calls, no writes, no deployments, no secrets or PII printed.
// Unlike operator preparation, CI checkout uses detached HEAD.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {prepareWorkHqV34LocalUi}
  from './prepare-work-hq-v34-ui-local.mjs';
const path=fileURLToPath(new URL(
  '../services/jill-order-desk/app-home/dist/server/wrangler.json',
  import.meta.url));
try{
  const raw=JSON.parse(readFileSync(path,'utf8'));
  const plan=prepareWorkHqV34LocalUi(raw);
  if(plan.local_manifest_only!==true||
     plan.deployment_authorized!==false||
     plan.cloudflare_version_uploaded!==false||
     plan.storage_activation_authorized!==false)
    throw Error('work_hq_v34_local_ui_policy_not_verified');
  console.log('PASS WORK v34 ACTUAL compiled canary manifest: exact WORK D1, OAuth ON, writes ON, details ON; all extra binding sections inert; no Cloudflare deployment.');
}catch(e){
  const code=String(e?.message||'compiled_manifest_unverified');
  const safe=/^work_hq_v34_local_ui_[a-z0-9_]+$/.test(code)?
    code:'compiled_manifest_unverified';
  console.error('STOP WORK v34 ACTUAL compiled manifest: '+safe);
  process.exitCode=1;
}
