import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const basename='JILL_Custom_Order_Automation_REWARDS';
const productionSheet='1xVG4Jvh-vLB6BH5QitNcLQuaLj6DkXeSlFHg_LkECT8';
const normalize=(text)=>text.replace(/\r\n?/g,'\n').trimEnd();
export const qaDigest=(text)=>createHash('sha256').update(normalize(text),'utf8').digest('hex');

function replaceExact(source,before,after,expected=1) {
  if(source.split(before).length-1!==expected) {
    throw new Error('Historical Custom Order QA build does not match its certified source: '+before);
  }
  return source.replaceAll(before,after);
}

export function reconstructCustomOrderQaSource(source,commit,sheetId) {
  if(!/^[0-9a-f]{40}$/.test(commit) ||
      !/^[a-zA-Z0-9_-]{30,100}$/.test(sheetId) ||
      sheetId===productionSheet) {
    throw new Error('Invalid historical QA source identity.');
  }
  let output=normalize(source);
  output=replaceExact(output,"const JILL_REWARDS_RUNTIME = 'LIVE';",
    "const JILL_REWARDS_RUNTIME = 'WORK';");
  output=replaceExact(output,'__JILL_REWARDS_BUILD_SHA__',commit);
  output=replaceExact(output,"STORE_URL: 'https://jillonlinestore.com'",
    "STORE_URL: 'https://jill-work.myshopify.com'");
  output=replaceExact(output,"STORE_EMAIL: 'info@jillonlinestore.com'",
    "STORE_EMAIL: 'qa@example.invalid'");
  output=replaceExact(output,"SHEET_ID: '"+productionSheet+"'","SHEET_ID: '"+sheetId+"'");
  output=replaceExact(output,"'jill-online-store.myshopify.com'",
    "'jill-work.myshopify.com'",2);
  output=output.replaceAll('jillonlinestore.com','jill-work.myshopify.com');
  output=replaceExact(output,'const JILL_CUSTOM_ORDER_SANDBOX = false;',
    'const JILL_CUSTOM_ORDER_SANDBOX = true;');
  return normalize(output);
}

export function auditPulledCustomOrderQa({directory,sheetId,gitReadAtSha}) {
  if(typeof gitReadAtSha!=='function') throw new Error('Historical Git source verifier is required.');
  const codeFiles=fs.readdirSync(directory)
    .filter(name=>/\.(?:gs|js|html)$/i.test(name)).sort();
  if(codeFiles.length!==1 ||
    ![basename+'.js',basename+'.gs'].includes(codeFiles[0])) {
    throw new Error('QA remote contains unknown or duplicate scripts; refusing overwrite: '+
      codeFiles.join(', '));
  }
  const file=codeFiles[0];
  const remote=normalize(fs.readFileSync(path.join(directory,file),'utf8'));
  if(!remote.includes("const JILL_REWARDS_RUNTIME = 'WORK';") ||
      !remote.includes('const JILL_CUSTOM_ORDER_SANDBOX = true;') ||
      !remote.includes("SHEET_ID: '"+sheetId+"'") ||
      remote.includes(productionSheet) ||
      remote.includes('jillonlinestore.com') ||
      remote.includes('jqtdgr-1y.myshopify.com')) {
    throw new Error('Pulled QA source has wrong runtime, spreadsheet or production scope.');
  }
  const match=remote.match(/const JILL_REWARDS_BUILD_SHA = '([a-f0-9]{40})';/);
  if(!match)throw new Error('Pulled QA source has no certified source commit.');
  const historical=gitReadAtSha(match[1]);
  if(qaDigest(remote)!==qaDigest(reconstructCustomOrderQaSource(historical,match[1],sheetId))) {
    throw new Error('QA Google remote differs from the certified Git build; refusing overwrite.');
  }
  return {file,commit:match[1],digest:qaDigest(remote)};
}

export function removeVerifiedStaleClaspJs(directory,pulled) {
  const local=path.join(directory,basename+'.js');
  if(!fs.existsSync(local))return false;
  const actual=qaDigest(fs.readFileSync(local,'utf8'));
  if(actual!==pulled.digest) {
    throw new Error('Stale local .js differs from verified QA remote; refusing deletion.');
  }
  fs.rmSync(local);
  return true;
}
