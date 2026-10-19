// Build a minimal release from the certified prior diagnostic source, not
// the newer unreleased conversation/account feature tree. No network.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SOURCE} from './work-gateway-diagnostic-release-policy.mjs';
import {exactManifest} from './work-gateway-version-metadata-inactive-policy.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HANDLER='services/custom-order-cloudflare/handler.mjs';
const GATEWAY='backend/custom-order-gateway.mjs';
const EMPTY='backend/empty-http-body.mjs';
const REVIEWED=Object.freeze({
  [HANDLER]:'6a0e06a6477d74e12d7d461584f5ee4abfcae731',
  [GATEWAY]:'b9f36124574463205b4b11d63a2d013f34c66686',
  [EMPTY]:'a9d573ed1031303cd10beb609d4b8f7eee2805f5',
});
const HISTORICAL=Object.freeze([
  'services/custom-order-cloudflare/worker.mjs',HANDLER,
  'services/custom-order-cloudflare/limiter.mjs',
  'services/custom-order-cloudflare/wrangler.toml',GATEWAY,
  'backend/custom-order-work-proxy-route.mjs',
  'backend/shopify-work-app-proxy-auth.mjs',
  'backend/custom-order-account-read.mjs',
  'backend/customer-account-work-session.mjs',
]);
export const gitBlob=text=>createHash('sha1')
  .update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
const fail=()=>{throw Error('work_gateway_diagnostic_release_source_unreviewed');};
function diagnosticBlock(source){
  const first=source.indexOf("  if(pathname==='/jill-work-gateway-diagnostic') {");
  const last=source.indexOf('  // Account reads are a distinct',first);
  if(first<0||last<first)fail();
  return source.slice(first,last);
}
export function diagnosticPackage({root=ROOT,
  readHistorical=p=>execFileSync('git',['-C',root,'show',SOURCE+':'+p],
    {encoding:'utf8',maxBuffer:1024*1024,windowsHide:true}),
  readReviewed=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n'),
}={}){
  const files=Object.fromEntries(HISTORICAL.map(p=>[p,readHistorical(p)]));
  const reviewed=Object.fromEntries(Object.keys(REVIEWED).map(p=>{
    const value=readReviewed(p);
    if(gitBlob(value)!==REVIEWED[p])fail();
    return [p,value];
  }));
  // Only the diagnostic block changes in the old handler. All submission,
  // account, limiter and runtime/config bytes remain the prior source.
  files[HANDLER]=files[HANDLER].replace(diagnosticBlock(files[HANDLER]),
    diagnosticBlock(reviewed[HANDLER]));
  files[GATEWAY]=reviewed[GATEWAY];files[EMPTY]=reviewed[EMPTY];
  exactManifest(files['services/custom-order-cloudflare/wrangler.toml']);
  for(const [file,text] of Object.entries(files)){
    for(const match of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
      const specifier=match[1];
      if(specifier.startsWith('node:')||specifier==='cloudflare:workers')continue;
      if(!specifier.startsWith('.')||
        !Object.hasOwn(files,path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier))))fail();
    }
  }
  const inventory=Object.entries(files).map(([file,text])=>({path:file,git_blob:gitBlob(text)}));
  return {files,inventory,base_source:SOURCE,
    package_sha256:createHash('sha256').update(JSON.stringify(inventory)).digest('hex')};
}
export function stageDiagnosticPackage(directory,options={}){
  if(fs.readdirSync(directory).length)fail();
  const result=diagnosticPackage(options);
  for(const [file,text] of Object.entries(result.files)){
    const target=path.join(directory,file);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,text,{flag:'wx'});
  }
  return {...result,app:path.join(directory,'services/custom-order-cloudflare')};
}
