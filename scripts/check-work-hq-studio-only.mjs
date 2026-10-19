// Exact reviewed presentation package; no business owner or handler changes.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP='services/jill-order-desk/app-home/';
const require=createRequire(path.join(ROOT,APP,'package.json')),ts=require('typescript');
export const STUDIO_SOURCE_BASE='9a92d0287e69628c63bd7bec9a5e3dace63f1c94';
const normalize=s=>s.replace(/\r\n?/g,'\n');
export const studioDigest=s=>createHash('sha256').update(normalize(s)).digest('hex');
// Presentation copy/layout can change; server declarations, component setup,
// command controls and business-component props retain their existing owner.
export function studioLogic(source){
 const tree=ts.createSourceFile('route.tsx',normalize(source),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const printer=ts.createPrinter({removeComments:true}),print=n=>printer.printNode(ts.EmitHint.Unspecified,n,tree);
 const declarations=[],commands=[];
 for(const node of tree.statements){
  if(ts.isFunctionDeclaration(node)&&node.body){
   // Server functions are compared in full, including their return values.
   if(['loader','action','shouldRevalidate','ErrorBoundary'].includes(node.name?.text))declarations.push(print(node));
   else declarations.push({name:node.name?.text,parameters:node.parameters.map(print),body:node.body.statements.filter(n=>!ts.isReturnStatement(n)).map(print)});
  }else if(ts.isImportDeclaration(node)){
   if(/\.css$/.test(node.moduleSpecifier.text))continue;
   declarations.push(print(node).replace(/\bNavLink,?\s*/g,''));
  }else declarations.push(print(node));
 }
 function visit(node){
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const tag=node.tagName.getText(tree);
   if(/^(?:Work[A-Z]\w*|input|button|select|textarea|form|fetcher\.Form)$/.test(tag))
    commands.push({tag,attributes:node.attributes.properties.filter(n=>!ts.isJsxAttribute(n)||!['className'].includes(n.name.text)).map(print)});
  }
  ts.forEachChild(node,visit);
 }visit(tree);return {declarations,commands};
}
export function assertStudioLogic(before,after){assert.deepEqual(studioLogic(after),studioLogic(before),'WORK visual release changed server logic, hooks or command props');}
export function checkWorkHqStudioOnly(){
 const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 assert.equal(git('branch','--show-current'),'jill/rewards-work');
 const reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/work-hq-studio-reviewed.json'),'utf8'));
 assert.equal(reviewed.baseline,STUDIO_SOURCE_BASE);
 const changed=git('diff','--name-only',STUDIO_SOURCE_BASE,'--','backend','extensions','theme','services').split(/\r?\n/).filter(Boolean);
 assert.deepEqual([...changed].sort(),Object.keys(reviewed.files).sort(),'Runtime presentation inventory differs from review');
 for(const file of changed){
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');
  assert.equal(studioDigest(source),reviewed.files[file],'Reviewed presentation differs: '+file);
  if(file.endsWith('.tsx'))assertStudioLogic(git('show',STUDIO_SOURCE_BASE+':'+file),source);
  else assert(!/!important|\bzoom\s*:|scale\(|\.Polaris|::part\(/i.test(source),'Forbidden visual override');
 }
 return {runtime_scope:'reviewed_presentation_only',reviewed_files:changed.length,server_hooks_and_command_props_unchanged:true,backend_theme_extensions_unchanged:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(checkWorkHqStudioOnly(),null,2));
