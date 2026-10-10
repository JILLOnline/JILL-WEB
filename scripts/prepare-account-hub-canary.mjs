import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertRewardsWorkConfig, WORK_STORE} from './verify-rewards-work-target.mjs';

// Creates an IGNORED local-only Shopify WORK app project, preserving the
// existing release UIDs but substituting official no-network canary entrypoints.
// No Shopify deploy, backend write, customer mutation, or LIVE config access.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workdir = path.join(root, '.work-account-canary');
const sentinel = '.jill-work-canary.json';
const appConfig = 'shopify.app.work.toml';
const modules = [
  ['jill-account-dashboard','Dashboard.jsx','My JILL'],
  ['jill-account-coupons','Coupons.jsx','Coupons'],
  ['jill-account-home','AccountHome.jsx','JILL Settings'],
];

export function makeCanaryModule(handle, mode = 'minimal') {
  if (mode !== 'minimal' && mode !== 'hub') throw new Error('Unsupported WORK canary mode');
  if (!modules.some(([dir]) => dir === handle)) throw new Error('Unexpected extension target');
  if (mode === 'hub' && handle === 'jill-account-dashboard') {
    return `import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import AccountHub from './hub/AccountHub.jsx';

export default async () => {
  render(<AccountHub />, document.body);
};
`;
  }
  const heading = modules.find(([dir]) => dir === handle)?.[2];
  const message = handle === 'jill-account-home'
    ? 'JILL WORK Profile extension rendered.'
    : `JILL WORK ${heading} full-page extension rendered.`;
  const content = handle === 'jill-account-home'
    ? `<s-section><s-text>${message}</s-text></s-section>`
    : `<s-page heading="${heading}" subheading="JILL WORK extension delivery test">
      <s-section>
        <s-heading>WORK runtime confirmed</s-heading>
        <s-text>${message}</s-text>
      </s-section>
    </s-page>`;
  return `import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(${content}, document.body);
};
`;
}

export function prepareCanary(mode) {
  assert.ok(['minimal','hub'].includes(mode), 'Canary must be minimal or hub');
  const configPath = path.join(root, appConfig);
  if (!fs.existsSync(configPath)) {
    throw new Error('Missing linked WORK app config; run the existing WORK app link flow first.');
  }
  const config = fs.readFileSync(configPath, 'utf8');
  const verified = assertRewardsWorkConfig(config);
  assert.equal(verified.store, WORK_STORE);
  const dependencyDirectory = path.join(root,'node_modules');
  if (!fs.existsSync(dependencyDirectory)) {
    throw new Error('Missing local dependencies; run npm install in the repository first.');
  }

  // Only ever clean our own ignored, sentinel-marked directory.
  if (fs.existsSync(workdir)) {
    const infoPath = path.join(workdir,sentinel);
    if (!fs.existsSync(infoPath)) throw new Error('Refusing to overwrite unknown canary directory.');
    const info = JSON.parse(fs.readFileSync(infoPath,'utf8'));
    if (info.owner !== 'jill-account-hub-work-canary' || info.store !== WORK_STORE) {
      throw new Error('Refusing to delete an unrecognized preview directory.');
    }
    fs.rmSync(workdir,{recursive:true,force:true});
  }
  fs.mkdirSync(workdir,{recursive:true});
  fs.writeFileSync(path.join(workdir,sentinel),JSON.stringify({
    owner:'jill-account-hub-work-canary',store:WORK_STORE,mode,
  })+'\n');
  // A Shopify CLI preview can check dependency state in its --path project.
  // Do not run this repository's large postinstall validation from an isolated
  // throwaway folder that intentionally has no theme/, scripts/ or backend/.
  // Preserve exact dependency/workspace versions and only remove postinstall.
  const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  if (pkg.scripts) delete pkg.scripts.postinstall;
  fs.writeFileSync(path.join(workdir,'package.json'),JSON.stringify(pkg,null,2));
  for (const filename of ['package-lock.json','.npmrc',appConfig]) {
    const from = path.join(root,filename);
    if (fs.existsSync(from)) fs.copyFileSync(from,path.join(workdir,filename));
  }
  // WORK app configuration may contain merchant-specific URLs; local-only and
  // gitignored. Preserve restrictive permission where supported.
  try { fs.chmodSync(path.join(workdir,appConfig),0o600); } catch {}

  // Resolve local installed dependencies from the original checked-out repo
  // without duplicating an entire node_modules tree in this throwaway copy.
  fs.symlinkSync(dependencyDirectory,path.join(workdir,'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir');
  for (const [handle,moduleName] of modules) {
    const dest = path.join(workdir,'extensions',handle);
    const base = path.join(root,'extensions',handle);
    fs.mkdirSync(path.join(dest,'src'),{recursive:true});
    fs.copyFileSync(path.join(base,'shopify.extension.toml'),
      path.join(dest,'shopify.extension.toml'));
    fs.copyFileSync(path.join(base,'package.json'),
      path.join(dest,'package.json'));
    fs.writeFileSync(path.join(dest,'src',moduleName),
      makeCanaryModule(handle,mode));
    if (mode === 'hub' && handle === 'jill-account-dashboard') {
      fs.mkdirSync(path.join(dest,'src','hub'),{recursive:true});
      fs.copyFileSync(path.join(base,'src','hub','AccountHub.jsx'),
        path.join(dest,'src','hub','AccountHub.jsx'));
    }
  }
  // The normal source tree is untouched. Shopify CLI --path points ONLY here.
  const expectedHandles = fs.readdirSync(path.join(workdir,'extensions')).sort();
  assert.deepEqual(expectedHandles, modules.map(([h])=>h).sort());
  console.log('WORK-only '+mode+' canary prepared under .work-account-canary/');
  console.log('No original source, release version, backend or customer data changed.');
  console.log('Shopify CLI must be run with --path .work-account-canary --config work --store '+WORK_STORE);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.includes('--hub') ? 'hub' : 'minimal';
  prepareCanary(mode);
}
