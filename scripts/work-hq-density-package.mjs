// Source composition only: no credentials, provider calls, data or receipts.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {assertStudioLogic,studioDigest} from './check-work-hq-studio-only.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const DENSITY_SOURCE_BASE='a6f650cf8bdf17781c30190d5b7017230aab6445';
export const DENSITY_RUNTIME_BASE='576d6b0bcde43c43fda939f42513eefcb5adefb7';
const APP='services/jill-order-desk/app-home';
export const DENSITY_FILES=Object.freeze([APP+'/app/routes/app.index.tsx',
 ...['hq-home','hq-theme','inbox','quote-worksheet','request-actions','request-detail'].map(x=>APP+'/app/styles/'+x+'.css')]);
const require=createRequire(path.join(ROOT,APP,'package.json')),ts=require('typescript');
const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{encoding:'utf8',maxBuffer:8000000,stdio:['ignore','pipe','pipe']}).trim();
export const densityManifest=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/work-hq-density-reviewed.json'),'utf8'));
function links(source){
 const tree=ts.createSourceFile('route.tsx',source.replace(/\r\n?/g,'\n'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),p=ts.createPrinter(),out=[];
 function visit(n){
  if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&['a','Link','NavLink'].includes(n.tagName.getText(tree)))
   out.push(n.attributes.properties.filter(a=>!ts.isJsxAttribute(a)||a.name.text!=='className').map(a=>p.printNode(ts.EmitHint.Unspecified,a,tree)));
  ts.forEachChild(n,visit);
 }visit(tree);return out;
}
export function assertDensityPresentation(before,after){assertStudioLogic(before,after);assert.deepEqual(links(before),links(after),'Density edition changed link behavior');}
export function checkWorkHqDensity(){
 assert.equal(git('branch','--show-current'),'jill/rewards-work');
 const m=densityManifest();assert.equal(m.source_baseline,DENSITY_SOURCE_BASE);assert.equal(m.runtime_baseline,DENSITY_RUNTIME_BASE);
 assert.deepEqual(Object.keys(m.files).sort(),[...DENSITY_FILES].sort(),'Unexpected density overlay path');
 const changed=git('diff','--name-only',DENSITY_SOURCE_BASE,'--','backend','extensions','theme','services').split(/\r?\n/).filter(Boolean);
 assert.deepEqual(changed.sort(),Object.keys(m.files).sort(),'Density runtime inventory differs');
 for(const [file,hash] of Object.entries(m.files)){
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');assert.equal(studioDigest(source),hash,'Density review differs: '+file);
  if(file.endsWith('.tsx'))assertDensityPresentation(git('show',DENSITY_SOURCE_BASE+':'+file),source);
  else assert(!/!important|\bzoom\s*:|scale\(|\.Polaris|::part\(/i.test(source),'Forbidden density scaling/override');
 }
 return {runtime_scope:'presentation_only',reviewed_files:changed.length,server_hooks_commands_and_links_unchanged:true,
  build_runtime_baseline:DENSITY_RUNTIME_BASE,unreleased_functional_work_excluded:true};
}
export function prepareDensityBuild({runner}={}){
 assert.match(runner||'',/^[a-f0-9]{40}$/);assert.equal(git('rev-parse','HEAD'),runner);checkWorkHqDensity();
 const parent=path.join(ROOT,APP,'.wrangler');fs.mkdirSync(parent,{recursive:true});
 const directory=fs.mkdtempSync(path.join(parent,'density-package-'));
 // Archive tracked source only: no local secret files, sessions or credentials.
 const archive=execFileSync('git',['-C',ROOT,'archive','--format=tar',DENSITY_RUNTIME_BASE],{maxBuffer:40000000,stdio:['ignore','pipe','pipe']});
 execFileSync('tar',['-xf','-','-C',directory],{input:archive,stdio:['pipe','pipe','pipe']});
 for(const [file,hash] of Object.entries(densityManifest().files)){
  const content=fs.readFileSync(path.join(ROOT,file));assert.equal(studioDigest(content.toString()),hash);
  fs.writeFileSync(path.join(directory,file),content);
 }
 // Reuse installed dependencies, never install/upgrade packages or copy env files.
 for(const relative of ['node_modules',APP+'/node_modules'])
  fs.symlinkSync(path.join(ROOT,relative),path.join(directory,relative),'junction');
 fs.writeFileSync(path.join(directory,'density-source.json'),JSON.stringify({runner,runtime_baseline:DENSITY_RUNTIME_BASE,files:densityManifest().files},null,2)+'\n');
 return path.join(directory,APP);
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(checkWorkHqDensity(),null,2));
