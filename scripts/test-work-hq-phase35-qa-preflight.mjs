// Phase 35 synthetic parser/authority tests ONLY. No Cloudflare/Google
// auth, customer requests, provider network, backend writes or version changes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {verifyPhase35ReadOnlyReceipts as verify}
  from './inspect-work-hq-phase35-qa-preflight.mjs';
const v34='4973b74d-d479-41da-897c-e36129303279';
const v33='204d66c3-3296-430d-8288-39c354876600';
const live=[
  'PASS WORK active Cloudflare exact v34 '+v34,
  'PASS rollback v33 preserved '+v33,
  'PASS all four secrets, WORK D1, OAuth ON, Owner setup OFF, writes ON; only detail flag added.',
  'PASS Google QA @9 source pin, original @7 inbox/status isolation.',
  'PASS live anonymous /healthz, /auth/login and Owner-only route denial.',
  'READ ONLY. No customer data read, Google/Shopify/D1 writes, traffic changes, secrets or LIVE/KEEP changes.',
].join('\n');
const parity=[
  'PASS WORK active v34 and preserved v33 rollback metadata.',
  'PASS WORK v34 live secret-binding names/types, D1, OAuth, Owner OFF, writes ON and detail ON match LOCAL UI candidate.',
  'PASS WORK canary compatibility date and fetch handler match.',
  'HOLD: Live Worker binary and client asset parity NOT proven; staging and deployment NOT approved.',
  'READ ONLY: Local manifest + Cloudflare metadata only, no customer reads or remote writes.',
].join('\n');
const good={liveOutput:live,parityOutput:parity};
let n=0;
const pass=verify(good);
assert.equal(pass.active_work_version,v34);
assert.equal(pass.preserved_v33_fallback,v33);
assert.equal(pass.exact_google_qa_v9_pin_checked,true);
assert.equal(pass.work_security_binding_metadata_matches,true);
assert.equal(pass.deployed_v34_binary_provenance_verified,false);
assert.equal(pass.real_status_mutation_verified,false);
assert.equal(pass.current_work_signed_in_owner_verified,false);
assert.equal(pass.v35_upload_authorized,false);
assert.equal(pass.v35_traffic_switch_authorized,false);
assert.equal(pass.billing_or_storage_authorized,false);
assert.ok(Object.isFrozen(pass));n++;
const fail=x=>{
  assert.throws(()=>verify(x),/work_hq_phase35_preflight_/);n++;
};
for(const value of [null,undefined,false,[],{},'pass'])fail(value);
fail({...good,customer:'sensitive@invalid.example'});
fail({...good,version:'v34'});
fail({liveOutput:live});
fail({parityOutput:parity});
for(const [key,current] of Object.entries(good)){
  fail({...good,[key]:null});
  fail({...good,[key]:current+'\nSTOP: unexpected'});
  fail({...good,[key]:current+'\nERROR: unexpected'});
  fail({...good,[key]:current+'\nFAIL provider'});
  fail({...good,[key]:'STOP: '+current});
  fail({...good,[key]:current+'\n'+current.split('\n')[0]});
  fail({...good,[key]:current.replace(current.split('\n')[0],'')});
  fail({...good,[key]:current.replace('PASS','WARN')});
  fail({...good,[key]:current+'a'.repeat(17000)});
  fail({...good,[key]:current.replace('READ ONLY','DEPLOY')});
}
fail({...good,liveOutput:live.replace(v34,v33)});
fail({...good,liveOutput:live.replace(v33,v34)});
fail({...good,liveOutput:live.replace('QA @9','QA @7')});
fail({...good,liveOutput:live.replace('@7 inbox/status','@9 inbox/status')});
fail({...good,parityOutput:parity.replace('NOT proven','proven')});
fail({...good,parityOutput:parity.replace('writes ON','writes OFF')});
fail({...good,parityOutput:parity.replace('Owner OFF','Owner ON')});
const source=readFileSync(fileURLToPath(new URL(
  './inspect-work-hq-phase35-qa-preflight.mjs',import.meta.url)),'utf8');
assert.match(source,/audit-work-hq-detail-v9-live\.mjs/);
assert.match(source,/inspect-work-hq-v34-ui-readiness\.mjs/);
assert.match(source,/WRANGLER_SEND_METRICS:'false'/);
assert.match(source,/readOnly\('live',\[\]\)/);
assert.match(source,/readOnly\('parity',\['--inspect'\]\)/);
assert.doesNotMatch(source,/\['versions','deploy'|\['versions','upload'|r2\.put\(|\.batch\(/);
console.log('PASS WORK Phase35 OFFLINE read-only QA preflight receipt contract: '+n+
  ' accept/reject fixtures, exact Cloudflare v34/v33 and Google @9/@7 safety labels; no source/binary or mutation authority.');
