import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  publishedVersion,inspectWorkQaSource,
} from './audit-work-hq-qa-versions.mjs';

const pinned='AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V';
const extra='AKfycby6C2Y2HMZB-vHyAikK-X8hrHhoXFSx-iU0o3w2qj4iO9J1jzo4P1rBJ7z3uqXkEvCN';
const listing='Found 3 deployments.\n- '+extra+' @8 - JILL HQ R/W\n- '+
  pinned+' @7\n- someOtherId @HEAD\n';
assert.equal(publishedVersion(listing,extra),8);
assert.equal(publishedVersion(listing,pinned),7);
assert.throws(()=>publishedVersion(listing+'- '+extra+' @8\n',extra),/ambiguous/);
assert.throws(()=>publishedVersion(listing,'no-such-deployment'),/missing_or_ambiguous/);
assert.throws(()=>publishedVersion('- '+extra+' @HEAD',extra),/invalid_published/);

const manifest={
  oauthScopes:['https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/userinfo.email'],
  webapp:{access:'ANYONE_ANONYMOUS',executeAs:'USER_DEPLOYING'},
};
const scope="const JILL_REWARDS_RUNTIME = 'WORK';\n"+
  'const JILL_CUSTOM_ORDER_SANDBOX = true;\n'+
  "SHEET_ID: '1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA'\n";
const features=[
  "if (clean_(e.parameter.jill_order_merchant_command) === '1') {return jillWorkHqMerchantCommand_(e);}",
  'function jillWorkHqMerchantCommandVerified_(e){}',
  'function jillWorkHqQaWritePreflight(){}',
  'function jillCustomOrderMerchantUpdateAsActor_(c,a){}',
  'const JILL_WORK_HQ_CACHE_SECONDS=15;',
  'function jillWorkHqQueueEmail_(c,r){}',
];
const full=scope+features.join('\n');
assert.equal(Object.values(inspectWorkQaSource(full,manifest)).every(Boolean),true);
const old=inspectWorkQaSource(scope,manifest);
assert.ok(Object.values(old).every(flag=>flag===false));
assert.throws(()=>inspectWorkQaSource(
  full.replace("= 'WORK'","= 'LIVE'"),manifest),/wrong_qa_scope/);
assert.throws(()=>inspectWorkQaSource(full,{
  ...manifest,oauthScopes:[...manifest.oauthScopes,
    'https://www.googleapis.com/auth/script.send_mail'],
}),/manifest_scope/);
assert.throws(()=>inspectWorkQaSource(full,{
  ...manifest,webapp:{access:'ANYONE',executeAs:'USER_DEPLOYING'},
}),/manifest_scope/);

const script=readFileSync('scripts/audit-work-hq-qa-versions.mjs','utf8');
assert.match(script,/verifyLocalWorkQaIdentity/);
assert.match(script,/auditPulledCustomOrderQa/);
assert.match(script,/readOnlyClasp|runReadOnlyClasp/);
assert.doesNotMatch(script,/invokeClasp\([^)]*,\s*['"](?:push|deploy|update-deployment|secret)['"]/);
console.log('PASS read-only WORK QA three-version audit: certified identity, published version selection, exact source features, no LIVE/Mail scopes or writes.');
