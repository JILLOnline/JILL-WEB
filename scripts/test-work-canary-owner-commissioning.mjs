import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';
import {
  prepareOwnerCommissioningManifest,writeOwnerCommissioningManifest,
} from './prepare-work-canary-owner-commissioning.mjs';

const locked={
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
const oauth=prepareOAuthManifest(locked);
const startLocked=JSON.stringify(locked),startOAuth=JSON.stringify(oauth);
const commissioned=prepareOwnerCommissioningManifest({locked,oauth});
assert.equal(commissioned.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(commissioned.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'true');
assert.equal(commissioned.name,'jill-order-desk-canary-work');
assert.equal(JSON.stringify(locked),startLocked);
assert.equal(JSON.stringify(oauth),startOAuth);
const reverted=structuredClone(commissioned);
reverted.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED='false';
assert.deepEqual(reverted,oauth);
for (const scenario of [
  {locked:{...locked,name:'jill-order-desk-work'},oauth},
  {locked,oauth:{...oauth,name:'jill-order-desk-work'}},
  {locked,oauth:{...oauth,main:'wrong-bundle.js'}},
  {locked,oauth:{...oauth,d1_databases:[]}},
  {locked,oauth:{...oauth,vars:{...oauth.vars,
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}}},
  {locked,oauth:{...oauth,vars:{...oauth.vars,
    JILL_WORK_OAUTH_ENABLED:'false'}}},
  {locked,oauth:{...oauth,vars:{...oauth.vars,
    SHOPIFY_API_SECRET:'never-put-secrets-in-manifest'}}},
])assert.throws(()=>prepareOwnerCommissioningManifest(scenario));

const dir=mkdtempSync(join(tmpdir(),'jill-work-owner-'));
try {
  const lockedPath=join(dir,'wrangler.json'),
    oauthPath=join(dir,'wrangler.oauth-canary.json'),
    outputPath=join(dir,'wrangler.owner-commissioning.json');
  writeFileSync(lockedPath,startLocked);
  writeFileSync(oauthPath,startOAuth);
  const receipt=writeOwnerCommissioningManifest({
    lockedPath,oauthPath,outputPath,
  });
  assert.equal(receipt.oauthEnabled,'true');
  assert.equal(receipt.ownerEnabled,'true');
  assert.equal(readFileSync(lockedPath,'utf8'),startLocked);
  assert.equal(readFileSync(oauthPath,'utf8'),startOAuth);
  assert.equal(JSON.parse(readFileSync(outputPath,'utf8'))
    .vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'true');
  assert.throws(()=>writeOwnerCommissioningManifest({
    lockedPath,oauthPath,outputPath,
  }),/already exists/);
  assert.throws(()=>writeOwnerCommissioningManifest({
    lockedPath,oauthPath,outputPath:oauthPath,
  }),/must not overwrite/);
}finally{
  rmSync(dir,{recursive:true,force:true});
}
console.log('PASS Owner commissioning manifest: only WORK canary Owner flag, verified OAuth baseline, no secrets, no source overwrite, rollback prepared.');
