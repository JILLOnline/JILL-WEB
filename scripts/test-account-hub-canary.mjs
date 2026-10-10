import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeCanaryModule} from './prepare-account-hub-canary.mjs';

const targets=[
  ['jill-account-dashboard','Dashboard.jsx','My JILL'],
  ['jill-account-coupons','Coupons.jsx','Coupons'],
  ['jill-account-home','AccountHome.jsx','JILL Settings'],
];
for (const [handle,filename] of targets) {
  const tsconfig = JSON.parse(fs.readFileSync('extensions/' + handle + '/tsconfig.json','utf8'));
  assert.equal(tsconfig.compilerOptions.jsx, 'react-jsx',
    handle + ' must compile modern JSX');
  assert.equal(tsconfig.compilerOptions.jsxImportSource, 'preact',
    handle + ' must resolve to preact/jsx-runtime, never react/jsx-runtime');
  assert.deepEqual(tsconfig.include, ['./src','./shopify.d.ts']);

  for (const mode of ['minimal','hub']) {
    const code=makeCanaryModule(handle,mode);
    assert.match(code,/import '@shopify\/ui-extensions\/preact';/);
    assert.match(code,/import \{render\} from 'preact';/);
    assert.match(code,/document\.body/);
    assert.match(code,/export default async/);
    assert.doesNotMatch(code,/shopify:\/\/customer-account\/api|shopify:\/\/storefront\/api|metafieldsSet|discountCodeBasicCreate/);
    assert.doesNotMatch(code,/jillonlinestore\.com|jqtdgr-1y\.myshopify\.com/);
    if (mode==='hub' && handle==='jill-account-dashboard') {
      assert.match(code,/import AccountHub from '\.\/hub\/AccountHub\.jsx'/);
      assert.match(code,/render\(<AccountHub \/>, document\.body\)/);
    } else {
      assert.match(code,handle==='jill-account-home'?/<s-section>/:/<s-page/);
      assert.doesNotMatch(code,/AccountHub/);
    }
  }
}
// The preview copies sources into an isolated folder; extension-local
// tsconfig MUST follow them or Shopify chooses React's missing JSX runtime.
const preparer=fs.readFileSync('scripts/prepare-account-hub-canary.mjs','utf8');
assert.match(preparer, /path\.join\(base,'tsconfig\.json'\)/);
assert.match(preparer, /jsxConfig\.compilerOptions\?\.jsxImportSource !== 'preact'/);
assert.match(preparer, /fs\.copyFileSync\(jsxConfigFile,path\.join\(dest,'tsconfig\.json'\)\)/);
assert.doesNotMatch(preparer, /react\/jsx-runtime/);

const actualHub=fs.readFileSync('extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
assert.match(actualHub,/<s-page heading="My JILL"/);
assert.match(actualHub,/<s-section>/);
assert.doesNotMatch(actualHub, /fetch\(|shopify\.shop|shopify\.query|useEffect|metafieldsSet/);
const scripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts;
for (const [name,flag] of [
  ['rewards:work:hub:canary',''],
  ['rewards:work:hub:preview','--hub'],
]) {
  const expected='node scripts/prepare-account-hub-canary.mjs'+(flag?' '+flag:'')+
    ' && shopify app dev --path .work-account-canary --config work --store jill-work.myshopify.com';
  assert.equal(scripts[name],expected,'All diagnostic previews must be isolated WORK-only.');
}
assert.match(fs.readFileSync('.gitignore','utf8'),/\.work-account-canary\//);
console.log('WORK My JILL minimal/hub canary contract verified. Browser rendering still requires CLI preview.');
