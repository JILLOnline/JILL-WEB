// WORK-only, non-mutating guard. Shopify app dev applies the LOCAL TOML
// as a dev preview and can override an otherwise correct active app version.
// Refuse to replace WORK HQ with Shopify's extension-only default homepage.
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {
  WORK_CONFIG_FILE,assertRewardsWorkConfig,
} from './verify-rewards-work-target.mjs';

export const WORK_HQ_HOME=
  'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const WORK_HQ_CALLBACK=WORK_HQ_HOME+'/auth/callback';

function stop() {
  throw Error('WORK HQ dev preview blocked: local app URL, embedded setting, '+
    'auth callback or build URL policy differs from the certified active '+
    'JILL HQ WORK app. DO NOT run shopify app dev with this config.');
}
function oneAssignment(source,name) {
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const matches=[...source.matchAll(
    new RegExp('^[ \\t]*'+escaped+'[ \\t]*=[ \\t]*([^\\r\\n#]+)','gm')
  )];
  if(matches.length!==1)stop();
  return matches[0][1].trim();
}
function section(source,name) {
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const matches=[...source.matchAll(
    new RegExp('^[ \\t]*\\['+escaped+'\\][ \\t]*\\r?\\n([\\s\\S]*?)(?=^[ \\t]*\\[|\\s*$)','gm')
  )];
  if(matches.length!==1)stop();
  return matches[0][1];
}
export function verifyWorkHqDevPreviewConfig(source) {
  assertRewardsWorkConfig(source,{requireHqName:true});
  // Only accept exact, uniquely declared values. No string substitutions
  // are performed and no secrets or customer data are read.
  if(oneAssignment(source,'application_url')!==JSON.stringify(WORK_HQ_HOME)||
     oneAssignment(source,'embedded')!=='true')stop();
  const auth=section(source,'auth');
  const redirects=auth.match(/^[ \\t]*redirect_urls[ \\t]*=[ \\t]*\\[([\\s\\S]*?)\\]/m);
  if(!redirects ||
     !redirects[1].includes(JSON.stringify(WORK_HQ_CALLBACK)))stop();
  const build=section(source,'build');
  if(oneAssignment(build,'automatically_update_urls_on_dev')!=='false')stop();
  return true;
}
if(process.argv[1] &&
   pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    if(process.argv.length!==2)stop();
    const file=resolve(process.cwd(),WORK_CONFIG_FILE);
    verifyWorkHqDevPreviewConfig(readFileSync(file,'utf8'));
    console.log('PASS local WORK preview preserves HQ App Home, embedded '+
      'mode, OAuth callback and disables automatic URL updates.');
    console.log('READ ONLY: no Shopify preview started or configuration changed.');
  }catch {
    console.error('STOP WORK preview: incorrect local App Home configuration. '+
      'Existing Shopify dev preview should be inspected/cleaned separately '+
      'only with Owner approval; never run app dev with placeholder.');
    process.exitCode=1;
  }
}
