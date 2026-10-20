// Reviewed WORK HQ compact table rows edition. The SQL proposal is deliberately
// excluded from the compiled Worker and NEVER run as a migration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {TABLE_ROWS_BLOBS,checkWorkHqTableRows}
  from './work-hq-table-rows-package.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {studioDigest} from './check-work-hq-studio-only.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP='services/jill-order-desk/app-home';
const PROPOSAL='services/jill-order-desk/archive-proposals/0010_work_request_soft_archive.sql';
const hex=/^[a-f0-9]{64}$/;
const source=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
export const TABLE_ROWS_RUNTIME_FILES=Object.freeze(
  Object.keys(TABLE_ROWS_BLOBS).filter(file=>file!==PROPOSAL));
export function checkWorkHqTableRowsRuntime(){
  const result=checkWorkHqTableRows();
  assert.equal(result.reviewed_files,21);
  assert.equal(TABLE_ROWS_RUNTIME_FILES.length,20);
  assert.equal(TABLE_ROWS_BLOBS[PROPOSAL]?.length,40);
  for(const file of TABLE_ROWS_RUNTIME_FILES){
    assert(!file.includes('..')&&!path.isAbsolute(file),'Unsafe path');
    const isReact=file.startsWith(APP+'/app/')&&
      /\.(?:ts|tsx|css)$/.test(file);
    const isServer=file.startsWith('services/jill-order-desk/')&&
      !file.includes('/app-home/')&&/\.mjs$/.test(file);
    assert(isReact||isServer,'Disallowed source overlay: '+file);
    assert(!/\/migrations\/|archive-proposals|\.env|secrets|wrangler/i.test(file),
      'Forbidden schema or configuration overlay');
  }
  return {environment:'WORK',mode:'FROZEN_TABLE_ROWS',
    runtime_files:TABLE_ROWS_RUNTIME_FILES.length,
    inert_sql_proposal_excluded:true,owner_search_gated:true,
    soft_remove_requires_future_schema_approval:true,
    no_live_or_gateway_changes:true};
}
export function tableRowsRuntimeManifest(){
  checkWorkHqTableRowsRuntime();
  const files=Object.fromEntries(
    TABLE_ROWS_RUNTIME_FILES.map(file=>[file,studioDigest(source(file))]));
  assert(Object.values(files).every(x=>hex.test(x)));
  return {runtime_baseline:DENSITY_RUNTIME_BASE,files};
}
export function prepareTableRowsRuntimeBuild({runner}={}){
  assert.match(runner||'',/^[a-f0-9]{40}$/);
  const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',timeout:20000}).trim();
  assert.equal(git('rev-parse','HEAD'),runner);
  const manifest=tableRowsRuntimeManifest();
  const parent=path.join(ROOT,APP,'.wrangler');
  fs.mkdirSync(parent,{recursive:true});
  const output=fs.mkdtempSync(path.join(parent,'hq-table-rows-'));
  // Use the same certified historical server baseline that shipped the
  // request details visual overlay; no unreviewed HEAD business features.
  const tar=execFileSync('git',['-C',ROOT,'archive','--format=tar',
    manifest.runtime_baseline],{maxBuffer:40000000,stdio:['ignore','pipe','pipe']});
  execFileSync('tar',['-xf','-','-C',output],{
    input:tar,stdio:['pipe','pipe','pipe']});
  for(const [file,hash] of Object.entries(manifest.files)){
    const content=source(file);
    assert.equal(studioDigest(content),hash,'Source changed: '+file);
    const destination=path.join(output,file);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,content,'utf8');
  }
  // Deliberately keep archive-proposals outside the active migrations dir.
  assert(!fs.existsSync(path.join(output,PROPOSAL)),
    'SQL proposal was included in deploy source');
  for(const relative of ['node_modules',APP+'/node_modules']){
    fs.symlinkSync(path.join(ROOT,relative),path.join(output,relative),'junction');
  }
  fs.writeFileSync(path.join(output,'hq-table-rows-source.json'),
    JSON.stringify({runner,manifest,sql_proposal_deployed:false},null,2)+'\n');
  return path.join(output,APP);
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqTableRowsRuntime(),null,2));
