import assert from 'node:assert/strict';
import {approvedVersionUrl,certifyCandidateHealth,STAGED}
 from './probe-work-hq-m1-m2-version-url-owner.mjs';
const good='https://abc123-jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/';
assert.equal(approvedVersionUrl(good).hostname,
 'abc123-jill-order-desk-canary-work.jill-work-custom-orders.workers.dev');
for(const bad of [
 'http://abc123-jill-order-desk-canary-work.abc.workers.dev/',
 'https://example.com/',
 'https://evil.workers.dev/?to=https://example.com/',
 'https://user:password@abc123-jill-order-desk-canary-work.abc.workers.dev/',
 'https://abc123-jill-order-desk-canary-work.abc.workers.dev@evil.com/',
 'https://abc123-jill-order-desk-canary-work.abc.workers.dev/unsafe',
 'https://abc123-jill-order-desk-canary-work.abc.workers.dev:444/',
 'https://abc123-jill-order-desk-canary-work.abc.workers.dev/#x',
 'https://foo.jill-order-desk-canary-work.abc.workers.dev/',
 'file:///etc/passwd','http://127.0.0.1','https://localhost',
])assert.throws(()=>approvedVersionUrl(bad),/m1m2_probe_url_/);
const params={status:200,mime:'application/json',location:null,
 cache:'no-store',version:STAGED.candidate,
 body:{ok:true,environment:'JILL_ORDER_DESK_WORK',
  database_ready:true,admin_ready:false}};
assert.equal(certifyCandidateHealth(params).exact_version,STAGED.candidate);
for(const change of [
 {status:404},{status:302},{mime:'text/html'},{location:'https://example.com'},
 {cache:'max-age=300'},{version:'00000000-0000-4000-8000-000000000000'},
 {body:{...params.body,database_ready:false}},
 {body:{...params.body,admin_ready:true}},
 {body:{...params.body,ignored:'extra'}}
])assert.throws(()=>certifyCandidateHealth({...params,...change}),
 /m1m2_probe_candidate_health_unverified/);
console.log('PASS exact WORK Version URL allowlist, strict candidate health and drift denials. All tests offline; no public request, upload or deployment.');
