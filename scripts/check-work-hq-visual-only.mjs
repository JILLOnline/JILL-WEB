// A presentation release cannot silently change handlers or backend owners.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP='services/jill-order-desk/app-home/';
const require=createRequire(path.join(ROOT,APP,'package.json'));
const ts=require('typescript');
export const VISUAL_BASE_SOURCE='69b709d9c2c6d0a4c075bef073381ec698b39373';
const routes=['app','app.index','app.requests','app.requests.$submissionId','app.catalog','app.access','app.setup-owner'];
const styles=['hq-theme','hq-home','inbox','request-detail','request-actions','quote-worksheet'];
const allowed=new Set([...routes.map(x=>APP+'app/routes/'+x+'.tsx'),...styles.map(x=>APP+'app/styles/'+x+'.css')]);
function behavior(source){
  const tree=ts.createSourceFile('route.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const printer=ts.createPrinter({removeComments:true});
  const print=node=>printer.printNode(ts.EmitHint.Unspecified,node,tree);
  const declarations=[],attributes=[],controls=[],text=[];
  for(const node of tree.statements){
    if(ts.isImportDeclaration(node)&&/\.css$/.test(node.moduleSpecifier.text))continue;
    if(ts.isFunctionDeclaration(node)&&node.modifiers?.some(x=>x.kind===ts.SyntaxKind.DefaultKeyword)){
      declarations.push({name:node.name?.text,parameters:node.parameters.map(print),
        body:node.body.statements.filter(x=>!ts.isReturnStatement(x)).map(print)});
    }else declarations.push(print(node));
  }
  function visit(node){
    if(ts.isJsxAttribute(node)&&!['className','inlineSize','aria-current'].includes(node.name.text))attributes.push(print(node));
    if(ts.isJsxSpreadAttribute(node))attributes.push(print(node));
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
      const name=node.tagName.getText(tree);if(/^(?:input|button|select|textarea|form|fetcher\.Form|Link|Outlet)$/.test(name))controls.push(name);
    }
    if(ts.isJsxText(node)&&node.text.trim())text.push(node.text.replace(/\s+/g,' ').trim());
    ts.forEachChild(node,visit);
  }visit(tree);return {declarations,attributes,controls,text};
}
export function assertVisualModule(before,after){assert.deepEqual(behavior(after),behavior(before),
  'Visual-only release changed server code, hooks, behavior attributes, controls or customer/policy copy');}
const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export function checkWorkHqVisualOnly(){
  assert.equal(git('branch','--show-current'),'jill/rewards-work');
  const changed=git('diff','--name-only',VISUAL_BASE_SOURCE,'--','backend','extensions','theme','services').split(/\r?\n/).filter(Boolean);
  for(const file of changed)assert(allowed.has(file),'Non-visual runtime file changed: '+file);
  for(const name of routes){
    const file=APP+'app/routes/'+name+'.tsx';
    assertVisualModule(git('show',VISUAL_BASE_SOURCE+':'+file),fs.readFileSync(path.join(ROOT,file),'utf8'));
  }
  for(const name of styles){const css=fs.readFileSync(path.join(ROOT,APP+'app/styles/'+name+'.css'),'utf8');
    assert(!/!important|\bzoom\s*:|scale\(|\.Polaris|::part\(/i.test(css),'Forbidden visual override/scaling');}
  return {runtime_scope:'presentation_only',server_handlers_and_hooks_unchanged:true,
    behavior_attributes_controls_and_copy_unchanged:true,backend_theme_extensions_unchanged:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  console.log(JSON.stringify(checkWorkHqVisualOnly(),null,2));
}
