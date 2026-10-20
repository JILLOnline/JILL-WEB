// Builds a LOCAL opt-in, canary-only Shopify OAuth rollout manifest.
// This script NEVER deploys to Shopify or Cloudflare and NEVER reads secrets.
// Source build manifest remains locked and unchanged for rollback.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';

const repoRoot=fileURLToPath(new URL('../',import.meta.url));
const location='services/jill-order-desk/app-home/dist/server';
const defaultSource=resolve(repoRoot,location,'wrangler.json');
const defaultOutput=resolve(repoRoot,location,'wrangler.oauth-canary.json');
const UUID='3f17c186-c794-4e00-8f20-017191373a19';
const WORKER='jill-order-desk-canary-work';

function ensure(condition,reason) {
  if(!condition)throw Error('WORK canary OAuth preparation refused: '+reason);
}

export function prepareOAuthManifest(config) {
  ensure(config && typeof config==='object' && !Array.isArray(config),
    'invalid Cloudflare manifest');
  ensure(config.name===WORKER,'must target isolated canary Worker');
  ensure(config.vars?.JILL_WORK_HOST_STAGE==='canary','invalid WORK stage');
  ensure(config.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false',
    'Owner setup must remain disabled');
  ensure(config.vars?.JILL_WORK_OAUTH_ENABLED==='false',
    'base manifest must be OAuth-locked');
  ensure(config.compatibility_flags?.includes('nodejs_compat'),
    'missing worker compatibility flag');
  ensure(config.d1_databases?.length===1 &&
    config.d1_databases[0].binding==='JILL_ORDER_DESK_WORK_DB' &&
    config.d1_databases[0].database_name==='jill-order-desk-work' &&
    config.d1_databases[0].database_id===UUID,
    'WORK merchant D1 binding mismatch');
  ensure(typeof config.main==='string' && config.main.length>0,
    'compiled Worker missing');
  ensure(!('SHOPIFY_API_SECRET' in config.vars) &&
    !('JILL_WORK_SESSION_KEY_B64' in config.vars),
    'secret must never be part of plaintext vars');
  const next=JSON.parse(JSON.stringify(config));
  next.vars.JILL_WORK_OAUTH_ENABLED='true';
  const back=JSON.parse(JSON.stringify(next));
  back.vars.JILL_WORK_OAUTH_ENABLED='false';
  ensure(isDeepStrictEqual(config,back),
    'unreviewed Cloudflare configuration change detected');
  return next;
}

export function writeOAuthManifest({source=defaultSource,output=defaultOutput}={}) {
  ensure(resolve(source)!==resolve(output),'source and output cannot match');
  ensure(existsSync(source),'build canary with JILL_BUILD_TARGET=canary first');
  ensure(!existsSync(output),'existing candidate must be reviewed or deleted');
  const original=readFileSync(source,'utf8');
  const candidate=prepareOAuthManifest(JSON.parse(original));
  // Fail closed under concurrent writes and never mutate the original output.
  writeFileSync(output,JSON.stringify(candidate,null,2)+'\n',
    {encoding:'utf8',flag:'wx',mode:0o600});
  ensure(readFileSync(source,'utf8')===original,
    'compiled base manifest unexpectedly changed');
  return Object.freeze({output,worker:candidate.name,
    ownerBootstrap:candidate.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,
    oauth:candidate.vars.JILL_WORK_OAUTH_ENABLED});
}

if(process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const result=writeOAuthManifest();
    console.log('PASS created local WORK canary OAuth candidate: '+result.output);
    console.log('Worker: '+result.worker);
    console.log('OAuth: opt-in TRUE; Owner bootstrap: FALSE.');
    console.log('Nothing deployed. Original OAuth-locked build remains unchanged.');
  } catch(error) {
    console.error(error.message);
    process.exitCode=1;
  }
}
