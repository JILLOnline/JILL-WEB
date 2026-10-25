// My JILL signed WORK preview: test the EXACT modules copied to the
// isolated Shopify CLI --read canary, not merely the normal repository build.
// Read-only source graph; no Shopify, Cloudflare, filesystem writes, or app link.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeCanaryModule,WORK_MYJILL_READ_SOURCE_MANIFEST}
 from './prepare-account-hub-canary.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourceFiles=new Set(WORK_MYJILL_READ_SOURCE_MANIFEST);
const entry='extensions/jill-account-dashboard/src/Dashboard.jsx';
const entryContent=makeCanaryModule('jill-account-dashboard','read');
assert.match(entryContent,/import ConnectedHub from '\.\/hub\/ConnectedHub\.jsx'/);
assert.doesNotMatch(entryContent,/import AccountHub from/);
assert.equal(sourceFiles.has(entry),false,
 'Canary entry must be generated, not copied from the canonical Dashboard');

for (const file of sourceFiles) {
 assert.equal(typeof file,'string');
 assert.ok(!file.includes('..')&&!file.startsWith('/'),file);
 assert.ok(existsSync(path.join(root,file)),
  'Canary copy target missing source file: '+file);
}
const all=new Set([...sourceFiles,entry]);
assert.equal(all.size,sourceFiles.size+1,'Duplicate manifest/entry paths');
const visited=new Set(),pending=[entry];
const external=new Set();
const regex=/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g;
while(pending.length){
 const file=pending.pop();
 if(visited.has(file))continue;
 assert.ok(all.has(file),'Uncopied relative dependency '+file);
 visited.add(file);
 const src=file===entry?entryContent:
  readFileSync(path.join(root,file),'utf8');
 assert.doesNotMatch(src,/\bimport\s*\(\s*['"]\./,
  'Dynamic relative imports need a separate allowlist');
 let m;
 regex.lastIndex=0;
 while((m=regex.exec(src))){
  const spec=m[1]||m[2];
  if(spec.startsWith('.')){
   const dest=path.posix.normalize(path.posix.join(
    path.posix.dirname(file),spec));
   assert.ok(all.has(dest),
    'SIGNED WORK CANARY IS MISSING '+dest+' imported from '+file);
   pending.push(dest);
  }else{
   assert.ok([
     'preact','preact/hooks','@shopify/ui-extensions/preact',
   ].includes(spec),'Unexpected external dependency '+spec+' in '+file);
   external.add(spec);
  }
 }
}
for(const must of [
 'extensions/jill-account-dashboard/src/hub/ConnectedHub.jsx',
 'extensions/jill-account-dashboard/src/pages/CustomOrders.jsx',
 'extensions/jill-account-dashboard/src/pages/Messages.jsx',
 'extensions/jill-account-dashboard/src/pages/Rewards.jsx',
 'shared/customer-custom-orders.mjs',
 'shared/custom-order-conversation-view.mjs',
 'shared/customer-message-selection.mjs',
 'shared/myjill-account-scope.mjs',
]){
 assert.ok(visited.has(must),'Signed preview did not reach '+must);
}
const copied=readFileSync('scripts/prepare-account-hub-canary.mjs','utf8');
assert.match(copied,/for \(const page of HUB_PAGE_FILES\)/);
assert.match(copied,/for \(const filename of HUB_SHARED_FILES\)/);
assert.match(copied,/fs\.copyFileSync\(path\.join\(root,'shared',filename\)/);
assert.match(copied,/fs\.copyFileSync\(path\.join\(base,'src','pages',page\)/);
assert.match(copied,/const component = \(mode === 'read' \|\| mode === 'template'\) \? 'ConnectedHub' : 'AccountHub'/);
assert.match(copied,/Refusing to delete an unrecognized preview directory/);
console.log('PASS My JILL signed WORK canary source graph: '+visited.size+
 ' exact copied modules resolved, '+external.size+
 ' supported package imports, missing conversation-view/selection prevented; no CLI, app link or deployment.');
