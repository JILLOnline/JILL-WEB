import fs from 'node:fs';
import path from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';
import {WORK_CLIENT_ID, WORK_STORE, WORK_CONFIG_FILE, assertRewardsWorkConfig} from './verify-rewards-work-target.mjs';

const root = process.cwd();
const output = path.join(root, '.work-backend');
const projectFile = path.join(output, '.work-project.json');
const claspFile = path.join(output, '.clasp.json');

if (execFileSync('git', ['branch', '--show-current'], {cwd:root,encoding:'utf8'}).trim() !== 'jill/rewards-work') {
  throw new Error('Refusing WORK backend bootstrap outside jill/rewards-work.');
}
if (!fs.existsSync(WORK_CONFIG_FILE)) {
  throw new Error('Shopify WORK app config missing. Link JILL WORK Rewards first.');
}
assertRewardsWorkConfig(fs.readFileSync(WORK_CONFIG_FILE,'utf8'));

const runClasp = (...args) => {
  const binary = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(binary, ['--yes', '@google/clasp@3.4.1', ...args], {
    cwd:output, stdio:'inherit', shell:process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Google clasp command failed. Fix authorization/Google Apps Script API access and retry.');
  }
};

execFileSync(process.execPath,['scripts/build-rewards-work-backend.mjs'],{cwd:root,stdio:'inherit'});
const hadClasp = fs.existsSync(claspFile);
const hadRecord = fs.existsSync(projectFile);
if (hadClasp !== hadRecord) {
  throw new Error('Incomplete WORK project metadata. Refusing to write to an unverified Google Apps Script project.');
}
if (!hadClasp) {
  // Creating a project requires an interactive Google OAuth login. This is
  // the user's own Google account; no token or secret passes through GitHub.
  runClasp('show-authorized-user');
  runClasp('create-script','--type','standalone','--title','JILL WORK Rewards Engine');
  if (!fs.existsSync(claspFile)) throw new Error('Google did not return a WORK Apps Script ID.');
  const {scriptId} = JSON.parse(fs.readFileSync(claspFile,'utf8'));
  if (!scriptId || typeof scriptId !== 'string') throw new Error('Invalid new Apps Script ID.');

  // clasp create-script can pull a boilerplate Code.gs; never upload it
  // alongside the two canonical JILL sources.
  const starter = path.join(output,'Code.gs');
  if (fs.existsSync(starter)) {
    const code = fs.readFileSync(starter,'utf8').replace(/\s+/g,'').replace(/;+/g,';');
    if (!['','functionmyFunction(){}','functionmyFunction(){;}'].includes(code)) {
      throw new Error('Unexpected starter script from Google. Refusing to overwrite or delete unknown source.');
    }
    fs.rmSync(starter);
  }
  fs.writeFileSync(projectFile,JSON.stringify({
    scriptId,clientId:WORK_CLIENT_ID,shop:WORK_STORE,origin:'clasp create-script in isolated .work-backend',
  },null,2)+'\n');
}
const current = JSON.parse(fs.readFileSync(claspFile,'utf8'));
const record = JSON.parse(fs.readFileSync(projectFile,'utf8'));
if (!current.scriptId || current.scriptId !== record.scriptId ||
    record.clientId !== WORK_CLIENT_ID || record.shop !== WORK_STORE) {
  throw new Error('WORK Apps Script project identity changed. Refusing to push.');
}

// Rebuild the manifest after clasp creates/clones the remote project, then
// ensure the upload contains *only* the canonical scripts.
execFileSync(process.execPath,['scripts/build-rewards-work-backend.mjs'],{cwd:root,stdio:'inherit'});
const codeFiles = fs.readdirSync(output).filter(f=>/\.(?:gs|js|html)$/.test(f)).sort();
const expected = ['JILL_Custom_Order_Automation_REWARDS.gs','JILL_Public_Promotions.gs'].sort();
if (JSON.stringify(codeFiles)!==JSON.stringify(expected)) {
  throw new Error('Unexpected WORK script files in isolated bundle; refusing clasp push.');
}
const manifest = JSON.parse(fs.readFileSync(path.join(output,'appsscript.json'),'utf8'));
if (manifest.webapp?.access !== 'ANYONE_ANONYMOUS' || manifest.webapp?.executeAs !== 'USER_DEPLOYING') {
  throw new Error('WORK webhook web-app manifest is invalid.');
}
runClasp('push','--force');
console.log('WORK source pushed to the separately created Google project.');
console.log('Google project: https://script.google.com/d/'+record.scriptId+'/edit');
console.log('NOT DEPLOYED OR AUTHORIZED: configure WORK-only Script Properties and approve Google access before setupJillRewards().');
