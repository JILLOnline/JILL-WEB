import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  WORK_CLIENT_ID,WORK_CONFIG_FILE,WORK_APP_NAME,WORK_APP_LEGACY_NAME,
  assertRewardsWorkConfig,
} from './verify-rewards-work-target.mjs';

// The Shopify CLI-pulled WORK configuration is untracked and store-specific.
// Preserve every URL, handle, extension, existing scope and app ID.
// The explicit minimum-HQ mode adds only its reviewed requested scopes.
export const WORK_HQ_MINIMUM_SCOPES=Object.freeze([
  'read_products','read_inventory','read_locations','read_draft_orders','write_draft_orders',
]);
// Local source preparation only. Preserve every existing scope, proxy, URL,
// identity and extension. Actual release and online consent are independent.
export function prepareWorkAppConfig(original,{minimumHqScopes=false}={}) {
  let content=original;
  const appId=content.match(/^\s*client_id\s*=\s*["']([^"']+)["']/m)?.[1];
  const appName=content.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1];
  if(appId!==WORK_CLIENT_ID ||
    (appName!==WORK_APP_LEGACY_NAME && appName!==WORK_APP_NAME))
    throw new Error('Refusing edits to an unknown/non-WORK Shopify app configuration.');
  if(appName===WORK_APP_LEGACY_NAME) {
    const nameLine=/^(\s*name\s*=\s*)["']JILL WORK Rewards["'](?=\s*$)/m;
    if(!nameLine.test(content))
      throw new Error('Ambiguous WORK Shopify app name configuration.');
    content=content.replace(nameLine,(_line,prefix)=>prefix+'"'+WORK_APP_NAME+'"');
  }
  const section=content.match(/\[access_scopes\]([\s\S]*?)(?=\n\[|$)/);
  const line=section?.[1]?.match(/^\s*scopes\s*=\s*["']([^"']*)["']/m);
  if(!section||!line)throw new Error('Missing WORK access_scopes configuration.');
  const current=line[1].split(',').map(x=>x.trim()).filter(Boolean);
  const required=['write_orders',...(minimumHqScopes?WORK_HQ_MINIMUM_SCOPES:[])];
  const added=required.filter(scope=>!current.includes(scope));
  if(added.length) {
    const next=[...current,...added].join(',');
    const modified=section[0].replace(line[0],line[0].replace(line[1],next));
    content=content.replace(section[0],modified);
  }
  // Validate the complete resulting config BEFORE writing any local file.
  assertRewardsWorkConfig(content,{requireHqName:true});
  return {content,addedScopes:added};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.length>1||(args.length===1&&args[0]!=='--minimum-hq-scopes'))
    throw Error('Unknown WORK app preparation mode. No config changed.');
  if(!fs.existsSync(WORK_CONFIG_FILE))
    throw Error('Existing linked WORK app configuration required. No app or URLs recreated.');
  const original=fs.readFileSync(WORK_CONFIG_FILE,'utf8');
  const result=prepareWorkAppConfig(original,{minimumHqScopes:args[0]==='--minimum-hq-scopes'});
  if(result.content!==original)fs.writeFileSync(WORK_CONFIG_FILE,result.content);
  console.log('Verified isolated '+WORK_APP_NAME+' local configuration; existing URLs, proxy and extension identities preserved.');
  console.log('Added local requested scopes: '+(result.addedScopes.join(',')||'none'));
  console.log('No Shopify release, consent, deployment or granted-scope change performed.');
}
