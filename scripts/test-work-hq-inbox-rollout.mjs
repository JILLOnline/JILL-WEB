import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  assertWorkHqInboxManifest,currentWorkerVersion,assertSecretNames,assertAnonymousInboxDenied,
} from './deploy-work-hq-inbox-shell.mjs';

const safe={
  name:'jill-order-desk-canary-work',
  vars:{
    JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OAUTH_ENABLED:'true',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  },
  compatibility_flags:['nodejs_compat'],
  d1_databases:[{
    binding:'JILL_ORDER_DESK_WORK_DB',
    database_id:'3f17c186-c794-4e00-8f20-017191373a19',
  }],
};
assert.equal(assertWorkHqInboxManifest(safe),true);
for(const bad of [
  {...safe,name:'jill-order-desk-canary-live'},
  {...safe,vars:{...safe.vars,JILL_WORK_HOST_STAGE:'LIVE'}},
  {...safe,vars:{...safe.vars,JILL_WORK_OAUTH_ENABLED:'false'}},
  {...safe,vars:{...safe.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},
  {...safe,vars:{...safe.vars,JILL_HQ_MERCHANT_READ_SECRET:'insecure'}},
  {...safe,d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',database_id:'LIVE'}]},
  {...safe,compatibility_flags:[]},
])assert.throws(()=>assertWorkHqInboxManifest(bad),/rollout refused/);
const version='dcd17f20-7b76-4332-8ea2-37fe74931f63';
assert.equal(currentWorkerVersion('Created: NOW\nVersion(s):  (100%) '+version+'\nTag: -'),version);
for(const weird of [
  '',
  'Version(s): (90%) '+version,
  'Version(s): (100%) '+version+'\nVersion(s): (100%) '+version,
])assert.throws(()=>currentWorkerVersion(weird),/rollout refused/);
const existing=JSON.stringify([
  {name:'SHOPIFY_API_SECRET',type:'secret_text'},
  {name:'JILL_WORK_SESSION_KEY_B64',type:'secret_text'},
]);
assert.equal(assertSecretNames(existing),true);
for(const secretText of [
  '[{"name":"JILL_HQ_MERCHANT_READ_SECRET"},'+existing.slice(1),
  '[{"name":"SHOPIFY_API_SECRET"}]',
  'not JSON', '[]',
])assert.throws(()=>assertSecretNames(secretText),/refused/);
const source=readFileSync('scripts/deploy-work-hq-inbox-shell.mjs','utf8');
assert.match(source,/JILL_BUILD_TARGET:'canary'/);
assert.match(source,/test:work-merchant-inbox/);
assert.match(source,/test:work-hq-google-merchant-feed/);
assert.match(source,/test:workerd-oauth/);
assert.match(source,/writeOAuthManifest/);
assert.match(source,/DEPLOY WORK INBOX SHELL/);
assert.match(source,/await anonymousInbox\(\)/);
for(const denied of [404,410])assert.equal(assertAnonymousInboxDenied(denied),true);
for(const status of [200,201,302,401,403,500,503])
  assert.throws(()=>assertAnonymousInboxDenied(status),
    /anonymous access must be denied/);
assert.doesNotMatch(source,/secret put|secret delete|owner-commissioning\.json|shopify app deploy|update-deployment|scriptProperties\.setProperty/i);
console.log('PASS WORK HQ inbox rollout: WORK identity, OAuth, Owner OFF, D1, required secrets, source secret absent, deployment-race denial and no other service writes.');
