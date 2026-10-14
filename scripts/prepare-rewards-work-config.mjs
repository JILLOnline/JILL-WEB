import fs from 'node:fs';
import {
  WORK_CLIENT_ID,WORK_CONFIG_FILE,WORK_APP_NAME,WORK_APP_LEGACY_NAME,
  assertRewardsWorkConfig,
} from './verify-rewards-work-target.mjs';

// The Shopify CLI-pulled WORK configuration is untracked and store-specific.
// Preserve every URL, handle, extension, scope and app ID. Only the app's
// human-readable name can change during the branding migration.
if (!fs.existsSync(WORK_CONFIG_FILE)) {
  throw new Error('Link the isolated WORK app before preparing JILL HQ.');
}
const original = fs.readFileSync(WORK_CONFIG_FILE,'utf8');
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
if(!current.includes('write_orders')) {
  const next=[...current,'write_orders'].join(',');
  const modified=section[0].replace(line[0],line[0].replace(line[1],next));
  content=content.replace(section[0],modified);
}
// Validate the complete resulting config BEFORE writing any local file.
assertRewardsWorkConfig(content,{requireHqName:true});
if(content!==original) {
  fs.writeFileSync(WORK_CONFIG_FILE,content);
  console.log('Prepared WORK app name '+WORK_APP_NAME+' (local config only).');
}
console.log('Verified isolated WORK Shopify app configuration; LIVE untouched.');
