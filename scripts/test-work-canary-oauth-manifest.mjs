import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  prepareOAuthManifest,writeOAuthManifest,
} from './prepare-work-canary-oauth-manifest.mjs';

const base={
 name:'jill-order-desk-canary-work',
 main:'index.js',
 compatibility_flags:['nodejs_compat'],
 vars:{
   JILL_WORK_HOST_STAGE:'canary',
   JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
   JILL_WORK_OAUTH_ENABLED:'false',
 },
 d1_databases:[{
   binding:'JILL_ORDER_DESK_WORK_DB',
   database_name:'jill-order-desk-work',
   database_id:'3f17c186-c794-4e00-8f20-017191373a19',
 }],
 assets:{directory:'../client'},
};
const frozen=JSON.stringify(base);
const next=prepareOAuthManifest(base);
assert.equal(next.name,base.name);
assert.equal(next.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(next.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
assert.equal(JSON.stringify(base),frozen,'source should not be mutated');
assert.equal(next.assets.directory,base.assets.directory);
assert.deepEqual(Object.keys(next),Object.keys(base));
for(const value of [
 {...base,name:'jill-order-desk-work'},
 {...base,vars:{...base.vars,JILL_WORK_HOST_STAGE:'work'}},
 {...base,vars:{...base.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},
 {...base,vars:{...base.vars,JILL_WORK_OAUTH_ENABLED:'true'}},
 {...base,d1_databases:[]},
 {...base,d1_databases:[{...base.d1_databases[0],database_id:'LIVE'}]},
 {...base,vars:{...base.vars,SHOPIFY_API_SECRET:'plaintext'}},
])assert.throws(()=>prepareOAuthManifest(value),
  /WORK canary OAuth preparation refused/);

const dir=mkdtempSync(join(tmpdir(),'jill-work-oauth-'));
try {
  const source=join(dir,'wrangler.json'),output=join(dir,'wrangler.oauth-canary.json');
  writeFileSync(source,frozen);
  const result=writeOAuthManifest({source,output});
  assert.equal(result.worker,'jill-order-desk-canary-work');
  assert.equal(result.ownerBootstrap,'false');
  assert.equal(result.oauth,'true');
  assert.equal(readFileSync(source,'utf8'),frozen);
  assert.equal(JSON.parse(readFileSync(output,'utf8')).vars.JILL_WORK_OAUTH_ENABLED,'true');
  assert.throws(()=>writeOAuthManifest({source,output}),
    /existing candidate must be reviewed or deleted/);
  assert.throws(()=>writeOAuthManifest({source,output:source}),
    /source and output cannot match/);
} finally {
  rmSync(dir,{recursive:true,force:true});
}
console.log('WORK OAuth manifest: single canary switch only, immutable base, Owner disabled, exact D1 and no plaintext secrets passed.');
