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
assert.equal(Object.keys(home.sections?.home?.blocks||{}).length,5);
assert.deepEqual(home.sections.home.block_order,['card_1','card_2','card_3','card_4','card_5']);
const requiredCategoryImages=['pinatas','favors','activities','supplies','apparel'];
for(let i=0;i<5;i++){
 const card=home.sections.home.blocks['card_'+(i+1)];
 assert.equal(card?.settings?.media_key,requiredCategoryImages[i],'Wrong category image '+i);
 assert.ok(!card.settings.link,'Do not link unpublished WORK collections in default homepage');
}
const showcase=read('sections/jill-home-showcase.liquid');
assert.ok(showcase.includes('case block.settings.media_key'),'Category photo must not depend on collection publication');
assert.ok(showcase.includes('if card_url != blank'),'Unpublished collection cards must not be clickable');
assert.ok(showcase.includes("default: '/pages/custom-order'"),'WORK homepage fallback must not target LIVE');
assert.ok(!showcase.includes("default: '/pages/quote?view=custom-order'"));
assert.ok(read('sections/jill-home-showcase.liquid').includes("'jill-home-showcase.css'"));
assert.ok(fs.existsSync(path.join(root,'assets/jill-home-showcase.css')));
for(const file of ['assets/jill-brand-logo.png','assets/jill-brand-favicon.png',
 'assets/jill-home-hero.jpg','assets/jill-home-pinatas.jpg','assets/jill-home-party-favors.jpg',
 'assets/jill-home-kids.jpg','assets/jill-home-party-supplies.jpg','assets/jill-home-apparel.jpg']){
 assert.ok(fs.existsSync(path.join(root,file)),'Brand asset missing: '+file);
}
assert.ok(read('sections/header.liquid').includes("'jill-brand-logo.png' | asset_url"),'Original JILL logo not linked');
assert.ok(read('layout/theme.liquid').includes("'jill-brand-favicon.png' | asset_url"),'JILL favicon not linked');
assert.ok(read('sections/jill-home-showcase.liquid').includes("'jill-home-hero.jpg' | asset_url"),'LIVE hero not linked');
assert.equal(home.sections.story?.type,'rich-text');
assert.equal(JSON.parse(read('templates/page.our-story.json')).sections.main.type,'main-page');
assert.ok(read('sections/main-page.liquid').includes('section.settings.fallback_body'));
assert.ok(read('sections/rich-text.liquid').includes('section.settings.anchor_id'));
assert.equal(home.sections.story?.settings?.anchor_id,'JillStory');
assert.ok(read('sections/header.liquid').includes('{{ routes.root_url }}#JillStory'));
assert.ok(read('sections/footer.liquid').includes('Every order means the world to us'));
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
 'assets/jill-storefront.css',
 'layout/theme.liquid',
 'sections/main-page.liquid',
 'sections/rich-text.liquid',
 'sections/footer.liquid',
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
