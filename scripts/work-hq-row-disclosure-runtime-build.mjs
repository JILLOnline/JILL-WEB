// WORK HQ v2 full-row disclosure runtime: compose EXACT prior frozen compact
// request-list baseline plus ONLY four newly reviewed React/CSS files.
// Never carry HEAD's unreleased Catalog/Quote/Messaging backend or extension.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {TABLE_ROWS_BLOBS} from './work-hq-table-rows-package.mjs';
import {TABLE_ROWS_RUNTIME_FILES} from './work-hq-table-rows-build.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {ROW_DISCLOSURE_BLOBS,checkWorkHqRowDisclosureEdition}
  from './work-hq-row-disclosure-edition.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP='services/jill-order-desk/app-home';
const NEW=Object.freeze([
  APP+'/app/routes/app.requests.tsx',
  APP+'/app/styles/inbox.css',
  APP+'/app/components/WorkRequestQuickActions.tsx',
  APP+'/app/styles/request-actions.css',
]);
const changed=new Set(NEW);
const digest=data=>createHash('sha1').update('blob '+data.length+
  String.fromCharCode(0)).update(data).digest('hex');
const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8',timeout:20000}).trim();
function historicBlob(hash){
  assert.match(hash,/^[a-f0-9]{40}$/);
  const bytes=execFileSync('git',['-C',ROOT,'cat-file','blob',hash],{
    timeout:20000,maxBuffer:10000000});
  assert.equal(digest(bytes),hash,'Historical Git blob is unverified');
  return bytes;
}
function currentBlob(file,hash){
  const bytes=fs.readFileSync(path.join(ROOT,file));
  const normalized=Buffer.from(bytes.toString('utf8').replace(/\r\n?/g,'\n'));
  assert.equal(digest(normalized),hash,'Current WORK UI source drift: '+file);
  return normalized;
}
export const ROW_DISCLOSURE_RUNTIME_FILES=Object.freeze(
  [...TABLE_ROWS_RUNTIME_FILES]);
export function reviewedRowRuntime(){
  checkWorkHqRowDisclosureEdition();
  assert.equal(TABLE_ROWS_RUNTIME_FILES.length,20);
  assert.equal(NEW.length,4);
  for(const file of NEW){
    assert(TABLE_ROWS_RUNTIME_FILES.includes(file),'Unexpected new runtime path');
    assert.notEqual(ROW_DISCLOSURE_BLOBS[file],TABLE_ROWS_BLOBS[file],
      'Expected new UI edition rather than historic version');
  }
  const files=Object.fromEntries(TABLE_ROWS_RUNTIME_FILES.map(file=>{
    const allowed=file.startsWith(APP+'/app/')&&/\.(?:tsx?|css)$/.test(file)||
      file.startsWith('services/jill-order-desk/')&&
      !file.includes('/app-home/')&&file.endsWith('.mjs');
    assert(allowed&&!file.includes('..')&&!file.includes('/migrations/')&&
      !/secrets|wrangler|\.env|archive-proposals/.test(file),
      'Unapproved runtime file '+file);
    const hash=changed.has(file)?ROW_DISCLOSURE_BLOBS[file]:TABLE_ROWS_BLOBS[file];
    assert.match(hash,/^[a-f0-9]{40}$/);
    if(changed.has(file))currentBlob(file,hash);
    else historicBlob(hash);
    return [file,hash];
  }));
  assert.equal(Object.keys(files).length,20);
  assert.deepEqual(
    Object.keys(files).filter(f=>files[f]!==TABLE_ROWS_BLOBS[f]).sort(),
    [...NEW].sort(),'Unreviewed runtime change');
  return Object.freeze({
    environment:'WORK',mode:'ISOLATED_HQ_ROW_DISCLOSURE_V1',
    runtime_baseline:DENSITY_RUNTIME_BASE,
    runtime_files:Object.keys(files).length,changed_files:[...NEW],
    sql_proposals_excluded:true,
    catalog_messaging_quote_backend_from_HEAD_excluded:true,
    customer_app_and_theme_excluded:true,
    cloudflare_deployment:false,
    files:Object.freeze(files),
  });
}
export function prepareRowDisclosureBuild({runner}={}){
  assert.match(runner||'',/^[a-f0-9]{40}$/);
  assert.equal(git('branch','--show-current'),'jill/rewards-work');
  assert.equal(git('rev-parse','HEAD'),runner);
  const approved=reviewedRowRuntime();
  const parent=path.join(ROOT,APP,'.wrangler');
  fs.mkdirSync(parent,{recursive:true});
  const output=fs.mkdtempSync(path.join(parent,'hq-row-disclosure-v1-'));
  // Compile the SAME backend baseline used for the previously released
  // compact-table runtime and layer the frozen 20-file reviewed set on it.
  const archive=execFileSync('git',['-C',ROOT,'archive','--format=tar',
    approved.runtime_baseline],{
    timeout:30000,maxBuffer:40000000,stdio:['ignore','pipe','pipe']});
  execFileSync('tar',['-xf','-','-C',output],{
    input:archive,timeout:30000,stdio:['pipe','pipe','pipe']});
  for(const [file,hash] of Object.entries(approved.files)){
    const content=changed.has(file)?currentBlob(file,hash):historicBlob(hash);
    const target=path.join(output,file);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,content);
  }
  for(const relative of ['node_modules',APP+'/node_modules']){
    const target=path.join(output,relative);
    assert(!fs.existsSync(target),'Unexpected embedded dependencies');
    fs.symlinkSync(path.join(ROOT,relative),target,'junction');
  }
  fs.writeFileSync(path.join(output,'hq-row-disclosure-reviewed.json'),
    JSON.stringify({runner,baseline:approved.runtime_baseline,
      files:approved.files,changed:NEW,cloudflare_deployment:false},null,2)+'\n');
  return path.join(output,APP);
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const plan=reviewedRowRuntime();
  console.log(JSON.stringify({environment:plan.environment,mode:plan.mode,
    runtime_baseline:plan.runtime_baseline,
    runtime_files:plan.runtime_files,changed_files:plan.changed_files,
    sql_proposals_excluded:plan.sql_proposals_excluded,
    catalog_messaging_quote_backend_from_HEAD_excluded:
      plan.catalog_messaging_quote_backend_from_HEAD_excluded,
    customer_app_and_theme_excluded:true,
    deployment:false},null,2));
}
