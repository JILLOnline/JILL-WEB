// Offline WORK HQ double-click/ambiguous result acceptance.
// No D1 writes, no browser/Owner session and no invoice publication.
import assert from 'node:assert/strict';
import {createWorkQuoteSaveFlight} from
 '../services/jill-order-desk/work-quote-save-flight.mjs';
import {createQuoteRecoveryBrowser} from './fixtures/work-quote-recovery-browser.mjs';
const browser=createQuoteRecoveryBrowser();
const opts={...browser,scope:'a'.repeat(64),submissionId:'jill:synthetic-request-1234'};
const pending={operationId:'jill:hq:quote:11111111-2222-4333-8444-555555555555',
 expectedDraftRevision:4,sourceRevision:3};
const proof={operation_id:pending.operationId,expected_draft_revision:4,state:'committed'};
const flight=createWorkQuoteSaveFlight(opts);
assert.equal(flight.isReserved(),false);
const clicks=Array.from({length:50},()=>flight.reserve(pending));
assert.equal(flight.isReserved(),true,'First click reserves before awaiting a lock');
assert.equal((await Promise.all(clicks)).filter(Boolean).length,1);
assert.equal(flight.isReserved(),true);
assert.equal(await flight.reserve(pending),false);
for(const invalid of [undefined,{...proof,state:'unresolved'},
 {...proof,operation_id:'jill:hq:quote:aaaaaaaa-2222-4333-8444-555555555555'},
 {...proof,expected_draft_revision:3}]){
 assert.equal(await flight.verifiedRelease(invalid),false);
 assert.deepEqual(flight.pending(),pending);
}
const remount=createWorkQuoteSaveFlight(opts);
assert.deepEqual(remount.pending(),pending,'Refresh/remount retains the original operation');
assert.equal(await remount.reserve({...pending,expectedDraftRevision:5}),false);
const foreign=createWorkQuoteSaveFlight({...opts,scope:'b'.repeat(64)});
assert.equal(foreign.pending(),null,'Different authenticated Owner gets no pending operation');
assert.equal(await remount.verifiedRelease(proof),true);
assert.equal(flight.pending(),null);
// Independent tabs contend through the same exclusive lock and marker.
const tabs=Array.from({length:20},()=>createWorkQuoteSaveFlight(opts));
assert.equal((await Promise.all(tabs.map(t=>t.reserve(pending)))).filter(Boolean).length,1);
assert.equal(await flight.verifiedRelease({...proof,state:'not_applied'}),true);
assert.equal(Object.isFrozen(flight),true);
assert.throws(()=>createWorkQuoteSaveFlight({...opts,locks:null}),/unavailable/);
const broken=createWorkQuoteSaveFlight({...opts,storage:{...browser.storage,
 setItem(){throw Error('quota denied');}}});
await assert.rejects(()=>broken.reserve(pending),/quota denied/);
// Explicitly corrupt the current key. Corruption must block, never reset it.
browser.storage.setItem('jill:work:quote-flight:'+opts.scope+':'+opts.submissionId,'{}');
assert.throws(()=>flight.pending(),/unverified/);
await assert.rejects(()=>flight.reserve(pending),/unverified/);
assert.equal(browser.storage.getItem('jill:work:quote-flight:'+opts.scope+':'+opts.submissionId),'{}');
console.log('PASS quote recovery lease: 50 clicks/20 tabs, remount retention, Owner partition, exact receipt release and storage/lock failure denial.');
