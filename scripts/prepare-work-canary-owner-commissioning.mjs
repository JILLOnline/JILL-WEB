// One-time WORK-only Owner commissioning manifest preparation.
// This does not deploy, mutate D1, release Shopify versions, or read secrets.
// The input is the same compiled canary build with its reviewed OAuth candidate.
// The resulting config enables exactly ONE additional server-side gate.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {prepareOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=resolve(root,'services/jill-order-desk/app-home/dist/server');
const sourceLocked=resolve(base,'wrangler.json');
const sourceOAuth=resolve(base,'wrangler.oauth-canary.json');
const target=resolve(base,'wrangler.owner-commissioning.json');

function guard(condition,reason) {
  if(!condition)throw new Error('WORK Owner commissioning refused: '+reason);
}

export function prepareOwnerCommissioningManifest({locked,oauth}) {
  // OAuth preparer checks exact canary Worker, DB id, stage, flags and no
  // plaintext credentials. Reconstruct it to prevent unreviewed changes.
  const expected=prepareOAuthManifest(locked);
  guard(isDeepStrictEqual(oauth,expected),
    'OAuth candidate differs from the locked source by more than OAuth flag');
  guard(oauth.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false',
    'Owner commissioning already on');
  guard(oauth.vars.JILL_WORK_OAUTH_ENABLED==='true',
    'Shopify login must remain enabled');
  const next=JSON.parse(JSON.stringify(oauth));
  next.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED='true';
  const reversed=JSON.parse(JSON.stringify(next));
  reversed.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED='false';
  guard(isDeepStrictEqual(reversed,oauth),
    'more than the Owner bootstrap flag changed');
  return next;
}

export function writeOwnerCommissioningManifest({
  lockedPath=sourceLocked,oauthPath=sourceOAuth,outputPath=target,
}={}) {
  const unique=new Set([lockedPath,oauthPath,outputPath].map(resolve));
  guard(unique.size===3,'output must not overwrite source manifests');
  guard(existsSync(lockedPath)&&existsSync(oauthPath),
    'canary build and OAuth candidate are required');
  guard(!existsSync(outputPath),'Owner commissioning candidate already exists');
  const lockedText=readFileSync(lockedPath,'utf8');
  const oauthText=readFileSync(oauthPath,'utf8');
  const result=prepareOwnerCommissioningManifest({
    locked:JSON.parse(lockedText),oauth:JSON.parse(oauthText),
  });
  // Fail if the files were modified concurrently; candidate is local only.
  guard(readFileSync(lockedPath,'utf8')===lockedText &&
    readFileSync(oauthPath,'utf8')===oauthText,
    'source manifest changed during preflight');
  writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',
    {encoding:'utf8',flag:'wx',mode:0o600});
  return Object.freeze({
    worker:result.name,oauthEnabled:result.vars.JILL_WORK_OAUTH_ENABLED,
    ownerEnabled:result.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,
    rollbackManifest:oauthPath,output:outputPath,
  });
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const r=writeOwnerCommissioningManifest();
    console.log('PASS local WORK Owner commissioning candidate: '+r.output);
    console.log('Worker: '+r.worker+' | OAuth '+r.oauthEnabled+
      ' | Owner '+r.ownerEnabled);
    console.log('NOT DEPLOYED. Roll back Owner flag using '+r.rollbackManifest);
  }catch(error) {
    console.error(error.message);
    process.exitCode=1;
  }
}
