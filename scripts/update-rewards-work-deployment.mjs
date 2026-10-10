import fs from 'node:fs';
import path from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';
import {WORK_CLIENT_ID, WORK_STORE, WORK_CONFIG_FILE, assertRewardsWorkConfig} from './verify-rewards-work-target.mjs';

// This is the *existing* WORK Web App deployment, verified by the user via
// its read-only v13 watchdog. Never create a replacement URL by accident.
const WORK_DEPLOYMENT_ID = 'AKfycbz1_pPlDOTXWeCCKbc14NlSQ4WeerAMF6xP8FZIl9c0sOcegndVj_Ncl4rbz1h3OyQ';
const root = process.cwd();
const output = path.join(root, '.work-backend');
const projectFile = path.join(output, '.work-project.json');
const claspFile = path.join(output, '.clasp.json');

if (execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim() !== 'jill/rewards-work') {
  throw new Error('Refusing Google WORK deployment update outside jill/rewards-work.');
}
if (!fs.existsSync(WORK_CONFIG_FILE)) throw new Error('Missing WORK Shopify app config.');
execFileSync(process.execPath,['scripts/prepare-rewards-work-config.mjs'],{cwd:root,stdio:'inherit'});
assertRewardsWorkConfig(fs.readFileSync(WORK_CONFIG_FILE,'utf8'));
if (!fs.existsSync(projectFile) || !fs.existsSync(claspFile)) {
  throw new Error('WORK Google project is not bootstrapped. Run rewards:work:backend:bootstrap first.');
}
const project = JSON.parse(fs.readFileSync(projectFile,'utf8'));
const clasp = JSON.parse(fs.readFileSync(claspFile,'utf8'));
if (!project.scriptId || clasp.scriptId !== project.scriptId ||
    project.clientId !== WORK_CLIENT_ID || project.shop !== WORK_STORE ||
    project.origin !== 'clasp create-script in isolated .work-backend') {
  throw new Error('Refusing Google deploy: WORK project identity does not match bootstrap record.');
}
if (!/^AKfycb[a-zA-Z0-9_-]+$/.test(WORK_DEPLOYMENT_ID)) {
  throw new Error('WORK deployment ID is malformed.');
}

const claspRun = (...args) => {
  // These arguments are entirely internal, constant values and contain no
  // customer data, secrets, spaces, or shell metacharacters.
  if (args.some(x => !/^[a-zA-Z0-9:_./-]+$/.test(x))) {
    throw new Error('Unexpected unsafe clasp command argument.');
  }
  const windows = process.platform === 'win32';
  const result = spawnSync(windows ? 'npx.cmd' : 'npx',
    ['--yes','@google/clasp@3.4.1',...args],{
      cwd:output,encoding:'utf8',shell:windows
    });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Google clasp failed ('+args[0]+'): '+String(result.stderr||result.stdout||'').slice(0,900));
  }
  return String(result.stdout||'');
};

// Verify Google itself lists the exact WORK deployment in the pinned project
// before any upload or publishing operation.
const existing = claspRun('list-deployments');
if (!existing.includes(WORK_DEPLOYMENT_ID)) {
  throw new Error('Existing WORK /exec deployment not found in this Google project. Refusing to deploy.');
}
// Rebuild and upload from the *canonical* engine using the guarded bootstrap.
// The bootstrap refuses unknown code files or a switched script ID.
execFileSync(process.execPath,['scripts/bootstrap-rewards-work-backend.mjs'],{cwd:root,stdio:'inherit'});
const result = claspRun('update-deployment',WORK_DEPLOYMENT_ID);
if (!result.includes(WORK_DEPLOYMENT_ID)) {
  throw new Error('Google did not confirm the expected WORK deployment ID: inspect Google Deploy > Manage deployments.');
}
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
console.log('Existing WORK Web App deployment updated from commit '+sha+'.');
console.log('Endpoint unchanged: https://script.google.com/macros/s/'+WORK_DEPLOYMENT_ID+'/exec');
console.log('No Rewards minute sweep, coupon generation or webhooks were activated by this deployment update.');
console.log('Next: verify ?jill_rewards_watchdog=1 reports this build SHA before running setupJillRewards().');
