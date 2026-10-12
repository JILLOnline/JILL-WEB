#!/usr/bin/env node
// Assemble an isolated WORK theme preview; never writes back into theme/ or deploys.
// Requires the reviewed governance branch. Refuses wrong store, dirty tracked files,
// unexpected source markers, and accidental fallback to a Google endpoint.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const source=path.join(root,'theme');
const dest=path.join(root,'.work-custom-order-theme');
const sentinel=path.join(dest,'.jill-work-theme.json');
const branch='jill/work-custom-order-integration';
const shop='jill-work.myshopify.com';
const read=(p)=>fs.readFileSync(p,'utf8');
function assert(ok,msg){if(!ok)throw Error(msg);}
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert(git('branch','--show-current')===branch,'Wrong branch; use the governance WORK branch');
assert(!git('status','--porcelain','--untracked-files=no'),'Dirty tracked files');
assert(fs.existsSync(path.join(source,'templates/page.custom-order.json')),'Missing canonical template');
const sectionFile=path.join(source,'sections/main-custom-order.liquid');
const assetFile=path.join(source,'assets/jill-custom-order.js');
const section=read(sectionFile);
const asset=read(assetFile);
const legacy='https://script.google.com/macros/s/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/exec';
assert(section.includes(legacy),'Unknown legacy endpoint; review before staging');
assert(section.includes('"id": "verified_submission_endpoint"'),'Missing verified endpoint setting');
assert(asset.includes("gateway.pathname!=='/apps/jill-custom-order'"),'Missing strict app proxy enforcement');
assert(asset.includes('receipt?.verified!==true'),'Missing verified receipt check');
assert(asset.includes('requestSentOnce'),'Missing replay protections');
if(fs.existsSync(dest)){
  if (fs.existsSync(sentinel)) {
    const old=JSON.parse(read(sentinel));
    assert(old.owner==='jill-work-custom-order-theme'&&old.shop===shop,'Wrong staging owner');
  } else {
    // A failed previous build may leave a partial ignored staging copy.
    // Recover ONLY when it contains our two exact canonical theme files,
    // no non-theme top-level entries, and is inside this repository.
    const allowed=new Set(['assets','config','layout','locales','sections',
      'snippets','templates','.theme-check.yml','.jill-work-theme.json']);
    const entries=fs.readdirSync(dest);
    assert(entries.length>0&&entries.every(name=>allowed.has(name)),
      'Unrecognized incomplete WORK stage; refusing removal');
    assert(fs.existsSync(path.join(dest,'templates/page.custom-order.json'))&&
      fs.existsSync(path.join(dest,'assets/jill-custom-order.js')),
      'Incomplete stage identity cannot be established');
    console.log('Recovering identified incomplete WORK staging copy.');
  }
  fs.rmSync(dest,{recursive:true,force:true});
}
fs.cpSync(source,dest,{recursive:true});
const stagedFile=path.join(dest,'sections/main-custom-order.liquid');
let staged=read(stagedFile);
// Catalog isolation: QA selects only the imported JILL smart collection, not
// Shopify's unrelated preloaded snowboard/sample products.
const globalProducts="assign all_products = collections['all']";
assert(staged.includes(globalProducts),'Custom Order global catalog source changed');
staged=staged.replace(globalProducts,
  "assign all_products = collections['jill']\n  assign jill_work_allowed_collections = 'pinatas,catalog,apparel-gifts-dtf-sublimation,kid-activities,party-supplies' | split: ','");
const collectionOpen='{% for catalog_collection in collections %}';
const collectionClose='            {% endunless %}\n          {% endfor %}';
assert(staged.includes(collectionOpen)&&staged.includes(collectionClose),
  'Custom Order collection loop changed');
staged=staged.replace(collectionOpen,
  collectionOpen+'\n            {% if jill_work_allowed_collections contains catalog_collection.handle %}');
staged=staged.replace(collectionClose,
  '            {% endunless %}\n            {% endif %}\n          {% endfor %}');

assert(staged.split(legacy).length===2,'Unexpected legacy URL count');
// Remove the default entirely so the staged form can NEVER silently POST to legacy Google.
staged=staged.replace(/,\s*"default":\s*"https:\/\/script\.google\.com\/macros\/s\/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA\/exec"\s*,?/,'');
assert(!staged.includes(legacy),'Legacy URL still present');
// Enable same-origin proxy only on the isolated staging copy.
const needle='"id": "verified_submission_endpoint",';
assert(staged.includes(needle),'Verified field not found');
staged=staged.replace(needle,needle+'\n      "default": "/apps/jill-custom-order",');
fs.writeFileSync(stagedFile,staged);
// Force the QA theme's browser transport to fail closed. The WEBSITE owner
// remains untouched: this replacement is confined to the ignored WORK package.
const stagedJSFile=path.join(dest,'assets/jill-custom-order.js');
let stagedJS=read(stagedJSFile);
// Restrict replacement to the canonical submitRequest body, but tolerate
// whitespace and formatting differences between website and WORK branches.
const endpointPattern=/const endpoint\s*=\s*String\(root\.dataset\.submitEndpoint\s*\|\|\s*''\)\.trim\(\);\s*if\s*\(!endpoint\)\s*fail\('submission is temporarily unavailable'\);/g;
const hits=[...stagedJS.matchAll(endpointPattern)];
assert(hits.length===1,'Expected exactly one legacy endpoint guard, got '+hits.length);
stagedJS=stagedJS.replace(endpointPattern,
  "const endpoint = '/apps/jill-custom-order';");
const fallbackPattern=/if\s*\(!verifiedPath\)\s*\{\s*await fetch\(endpoint,\s*\{method:'POST',mode:'no-cors',keepalive:true,body\}\);\s*return;[^\n]*\n\s*\}/g;
const fallbacks=[...stagedJS.matchAll(fallbackPattern)];
assert(fallbacks.length===1,'Expected exactly one legacy fetch fallback, got '+fallbacks.length);
stagedJS=stagedJS.replace(fallbackPattern,
  "if (verifiedPath !== endpoint) { fail('WORK verified Shopify app proxy is not configured'); }");
assert(!stagedJS.includes('mode:\'no-cors\''),'Unverified submission transport remains');
fs.writeFileSync(stagedJSFile,stagedJS);

// Only change the homepage link in the isolated QA package; website lane remains canonical.
const homeFile=path.join(dest,'templates/index.json');
const home=JSON.parse(read(homeFile));
assert(home.sections?.custom?.settings?.button_link==='/pages/quote?view=custom-order',
  'Homepage link differs from certified old route; inspect before changing');
home.sections.custom.settings.button_link='/pages/custom-order';
fs.writeFileSync(homeFile,JSON.stringify(home,null,2)+'\n');

const schema=staged.match(/{% schema %}([\s\S]*?){% endschema %}/);
assert(schema,'Missing Liquid schema');
JSON.parse(schema[1]);
assert(!read(stagedFile).includes('script.google.com/macros/s/'),'Google Script fallback still present');
// The published store can override section defaults using templates/settings data.
 // Refuse staging an inherited template that points at a different endpoint.
const template=JSON.parse(read(path.join(dest,'templates/page.custom-order.json')));
const settings=template.sections?.main?.settings||{};
assert(!settings.submission_endpoint,'Unexpected explicit legacy submission override');
assert(!settings.verified_submission_endpoint ||
  settings.verified_submission_endpoint==='/apps/jill-custom-order',
  'Unexpected verified endpoint override');
template.sections.main.settings={
  ...settings,
  submission_endpoint:'',
  verified_submission_endpoint:'/apps/jill-custom-order',
};
fs.writeFileSync(path.join(dest,'templates/page.custom-order.json'),
  JSON.stringify(template,null,2)+'\n');
const info={owner:'jill-work-custom-order-theme',shop,sourceCommit:git('rev-parse','HEAD'),endpoint:'/apps/jill-custom-order',kind:'unpublished-preview-only'};
fs.writeFileSync(sentinel,JSON.stringify(info,null,2)+'\n');
console.log('Prepared isolated WORK staging theme at .work-custom-order-theme/');
console.log('Pinned source '+info.sourceCommit);
console.log('Proxy /apps/jill-custom-order; legacy Google default removed from staging.');
console.log('Next: node scripts/audit-theme-dependencies.mjs .work-custom-order-theme');
console.log('NO THEME UPLOAD, LIVE RELEASE, APP RELEASE OR BACKEND WRITE.');
