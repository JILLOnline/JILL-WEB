#!/usr/bin/env node
// Read-only Custom Order theme dependency audit. No Shopify login or deployment.
// Usage: node scripts/audit-theme-dependencies.mjs [theme-directory]
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2] || 'theme');
const section=path.join(root,'sections/main-custom-order.liquid');
const template=path.join(root,'templates/page.custom-order.json');
const layout=path.join(root,'layout/theme.liquid');
const failures=[];
function read(file){try{return fs.readFileSync(file,'utf8');}catch{failures.push('MISSING: '+path.relative(root,file));return '';}}
const tpl=read(template);
const liquid=read(section);
const mainLayout=read(layout);
try {const t=JSON.parse(tpl);if(t.sections?.main?.type!=='main-custom-order') failures.push('Template does not reference canonical section');}
catch{failures.push('Invalid page.custom-order.json');}
const refs=new Set();
function checkLiquid(src,owner){
  for(const m of src.matchAll(/{%\s*(?:render|include)\s*['"]([^'"]+)['"]/g))refs.add(m[1]);
  for(const m of src.matchAll(/['"]([\w./-]+\.(?:js|css|svg))['"]\s*\|\s*asset_url/g)){
    const asset=m[1];if(asset.includes('..')){failures.push('Unsafe asset path: '+asset);continue;}
    const file=path.join(root,'assets',asset);
    if(!fs.existsSync(file)&&asset!=='jill-foundation.css')failures.push('Missing asset in '+owner+': '+asset);
    if(asset==='jill-foundation.css'&&!fs.existsSync(file)&&!fs.existsSync(file+'.liquid'))
      failures.push('Missing foundation stylesheet');
  }
}
checkLiquid(liquid,'main-custom-order');
checkLiquid(mainLayout,'theme layout');
const checked=new Set();
while(refs.size){
  const name=refs.values().next().value;refs.delete(name);
  if(checked.has(name))continue;
  if(!/^[a-zA-Z0-9_-]+$/.test(name)){failures.push('Unsafe snippet: '+name);continue;}
  checked.add(name);
  const file=path.join(root,'snippets',name+'.liquid');
  checkLiquid(read(file),name);
}
if(!liquid.includes('verified_submission_endpoint'))
  failures.push('Custom Order section lacks verified app-proxy setting');
const runtimeSnippetName='jill-custom-order-runtime';
const snippetInvocation="{% render '"+runtimeSnippetName+"' %}";
const hasSharedLoader=mainLayout.includes(snippetInvocation);
const sharedLoader=hasSharedLoader
  ?read(path.join(root,'snippets',runtimeSnippetName+'.liquid')):'';
for(const name of ['jill-custom-order.js','jill-custom-order-catalog-groups.js']){
  if(!fs.existsSync(path.join(root,'assets',name)))failures.push('Missing form JS: '+name);
  if(!mainLayout.includes("'"+name+"'") && !sharedLoader.includes("'"+name+"'"))
    failures.push('Custom Order runtime does not load form JS: '+name);
}
if(hasSharedLoader && !liquid.includes(snippetInvocation))
  failures.push('WORK homepage QA preview does not share the Custom Order runtime');
console.log('Custom Order theme direct/recursive Liquid references: '+checked.size);
console.log('Theme root: '+root);
if(failures.length){for(const f of failures)console.error(f);process.exitCode=1;}
else console.log('Static dependency PASS. Does NOT certify translations, dynamic references, security, WORK route or Shopify deployment.');
