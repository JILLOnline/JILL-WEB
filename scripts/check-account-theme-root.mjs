#!/usr/bin/env node
// Validate the Shopify-connectable WORK theme at ACCOUNT branch root.
// ACCOUNT's /theme directory remains a source snapshot for existing app tests;
// root folders are the generated Shopify adapter. No deployment or writes here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const required=[
  'config/settings_schema.json',
  'config/settings_data.json',
  'layout/theme.liquid',
  'sections/header.liquid',
  'sections/main-custom-order.liquid',
  'sections/main-contact.liquid',
  'templates/index.json',
  'templates/page.custom-order.json',
  'assets/jill-custom-order.js',
  'locales/en.default.json',
];
for(const file of required)assert.ok(fs.existsSync(path.join(root,file)),'Missing root Shopify theme file: '+file);
const custom=read('sections/main-custom-order.liquid');
const js=read('assets/jill-custom-order.js');
assert.ok(custom.includes("assign all_products = collections['jill']"),'WORK catalog must select JILL only');
assert.ok(custom.includes('jill_work_allowed_collections'),'WORK collection picker requires allowlist');
assert.ok(!custom.includes('script.google.com/macros/s/'),'Legacy Google endpoint forbidden in WORK theme');
assert.ok(js.includes("const endpoint = '/apps/jill-custom-order'"),'WORK endpoint must be fixed');
assert.ok(js.includes('verifiedPath !== endpoint'),'WORK proxy must fail closed');
assert.ok(js.includes('receipt?.verified!==true'),'WORK receipt verification missing');
assert.ok(!js.includes("mode:'no-cors'"),'Unverified legacy transport forbidden');
const schemaText=custom.match(/{% schema %}([\s\S]*?){% endschema %}/)?.[1];
assert.ok(schemaText,'Missing Custom Order schema');
const schema=JSON.parse(schemaText);
const settings=new Map(schema.settings.map(x=>[x.id,x]));
assert.equal(settings.get('verified_submission_endpoint')?.default,'/apps/jill-custom-order');
assert.ok(!settings.get('submission_endpoint')?.default,'No legacy default allowed');
const page=JSON.parse(read('templates/page.custom-order.json'));
assert.equal(page.sections?.main?.settings?.verified_submission_endpoint,'/apps/jill-custom-order');
assert.equal(page.sections?.main?.settings?.submission_endpoint,'');
const home=JSON.parse(read('templates/index.json'));
assert.equal(home.sections?.home?.type,'jill-home-showcase');
assert.equal(home.sections?.home?.settings?.custom_order_link,'/pages/custom-order');
assert.equal(Object.keys(home.sections?.home?.blocks||{}).length,4);
assert.ok(read('sections/jill-home-showcase.liquid').includes("'jill-home-showcase.css'"));
assert.ok(fs.existsSync(path.join(root,'assets/jill-home-showcase.css')));
assert.ok(read('sections/header.liquid').includes("| default: '/pages/custom-order'"),'Header must point to WORK Custom Order');
assert.ok(read('sections/main-contact.liquid').includes("| default: '/pages/custom-order'"),'Contact must point to WORK Custom Order');

const managedFolders=['assets','config','layout','locales','sections','snippets','templates'];
const overlay=new Set([
 'sections/main-custom-order.liquid',
 'assets/jill-custom-order.js',
 'templates/page.custom-order.json',
 'templates/index.json',
 'sections/header.liquid',
 'sections/main-contact.liquid',
]);
const storeEditable=p=>p==='config/settings_data.json'||
  p==='sections/header-group.json'||p==='sections/footer-group.json'||
  /^templates\/.*\.json$/.test(p);
let checked=0;
function visit(dir){
 for(const item of fs.readdirSync(path.join(root,'theme',dir),{withFileTypes:true})){
  const rel=path.posix.join(dir,item.name);
  if(item.isDirectory())visit(rel);
  else if(item.isFile()&&!overlay.has(rel)&&!storeEditable(rel)){
   const generated=path.join(root,rel),source=path.join(root,'theme',rel);
   assert.ok(fs.existsSync(generated),'Missing mirrored source: '+rel);
   assert.ok(fs.readFileSync(generated).equals(fs.readFileSync(source)),
     'Unexpected shared theme code divergence: '+rel);
   checked++;
  }
 }
}
for(const dir of managedFolders)visit(dir);
console.log('ACCOUNT Shopify root PASS; '+checked+' shared source files checked, 6 WORK overlays guarded.');
console.log('No Shopify deployment or account app release performed.');
