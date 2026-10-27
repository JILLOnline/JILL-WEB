// Offline WORK HQ double-click/ambiguous result acceptance.
// No D1 writes, no browser/Owner session and no invoice publication.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkQuoteSaveFlight} from
 '../services/jill-order-desk/work-quote-save-flight.mjs';

const flight=createWorkQuoteSaveFlight();
assert.equal(flight.isReserved(),false);
assert.equal(flight.reserve(),true,'First click reserves synchronously');
for(let i=0;i<50;i++)assert.equal(flight.reserve(),false,
 '50 rapid clicks must never reserve another quote Save');
assert.equal(flight.isReserved(),true);
// Simulate a timeout, an ambiguous reply, and a Save acknowledgment.
// None is proof that the D1 draft was independently re-read.
assert.equal(flight.reserve(),false,'A response alone cannot release the reservation');
flight.verifiedRelease();
assert.equal(flight.reserve(),true,
 'Only the independently verified readback gate can permit a later Save');
assert.equal(flight.reserve(),false);
flight.verifiedRelease();
assert.equal(Object.isFrozen(flight),true);
const path='services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx';
const s=readFileSync(path,'utf8');
assert.match(s,/saveFlight=useRef\(createWorkQuoteSaveFlight\(\)\)/);
assert.match(s,/const canSaveDraft=canReloadDraft&&!blocked&&!saveFlight\.current\.isReserved\(\)/);
assert.match(s,/if\(!canSaveDraft\|\|!readyQuote\|\|saveFlight\.current\.isReserved\(\)\)return/);
assert.match(s,/if\(!saveFlight\.current\.reserve\(\)\)return;\s*setBlocked\(true\);\s*operation\.current=op;\s*saveFetcher\.submit/);
assert.match(s,/if\(check\.state==="apply"&&projection\)/);
const release=s.indexOf('saveFlight.current.verifiedRelease()');
const verified=s.indexOf('if(check.state==="apply"&&projection)');
const next=s.indexOf('if(check.state==="none")');
assert.ok(release>verified&&release<next,
 'Reservation released ONLY in independently verified draft restore branch');
assert.equal(s.split('saveFlight.current.verifiedRelease()').length,2);
assert.match(s,/acknowledgedRevision\.current=rev/);
assert.match(s,/processedSaveResponse\.current===saveFetcher\.data/);
assert.match(s,/describeWorkQuoteSaveFailure\(saveFetcher\.data\.code\)/);
assert.doesNotMatch(s,/draftOrderCreate|draftOrderInvoiceSend|localStorage|sessionStorage/);
console.log('PASS HQ quote single-flight: rapid clicks suppressed, unknown Save remains held, verified readback alone releases next write.');
