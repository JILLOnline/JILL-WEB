// Quote Save -> Reload acceptance policy. Offline synthetic test only;
// real Shopify Owner/D1 acceptance still requires distinct approval.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectWorkQuoteReload as check}
 from '../services/jill-order-desk/work-quote-readback-policy.mjs';

const draft=revision=>({state:'verified_draft_restore',draftRevision:revision});
const opts=(code,revision,ack=null,edited=false,explicit=false)=>({
 readCode:code,restored:revision===null?null:draft(revision),
 acknowledgedRevision:ack,merchantEdited:edited,explicitReload:explicit,
});
const state=input=>check(input).state;
const code=input=>check(input).code;
assert.equal(state(opts('no_saved_draft',null)),'none');
assert.equal(code(opts('no_saved_draft',null,5)),'acknowledged_draft_not_visible');
assert.equal(code(opts('draft_ready',4,5,false,true)),'stale_draft_readback');
assert.equal(code(opts('draft_ready',4,5)),'stale_draft_readback');
assert.equal(code(opts('draft_ready',6,5)),'different_draft_revision');
assert.equal(state(opts('draft_ready',6,5,false,true)),'apply',
 'Owner explicitly chose to reload newer fully verified revision');
assert.equal(state(opts('draft_ready',5,5)),'apply');
assert.equal(code(opts('draft_ready',5,5,true,false)),'unsaved_editor_changes');
assert.equal(state(opts('draft_ready',5,5,true,true)),'apply');
assert.equal(code(opts('draft_ready',null,5)),'unverified_readback');
assert.equal(code(opts('not_authorized',5,5)),'unverified_readback');
assert.equal(code(opts('draft_ready',5,0)),'invalid_acknowledged_revision');
assert.equal(code(opts('draft_ready',5,101)),'invalid_acknowledged_revision');
assert.equal(code(opts('draft_ready',5,null,'false')),'invalid_editor_state');
assert.equal(Object.isFrozen(check(opts('draft_ready',5,5))),true);

const ui=readFileSync(
 'services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx',
 'utf8');
assert.match(ui,/inspectWorkQuoteReload\(\{/);
assert.match(ui,/acknowledgedRevision\.current=rev/);
assert.match(ui,/acknowledgedRevision:acknowledgedRevision\.current/);
assert.match(ui,/merchantEdited:merchantEdited\.current/);
assert.match(ui,/explicitReload:merchantExplicitReload\.current/);
assert.match(ui,/if\(check\.state==="apply"&&projection\)/);
assert.match(ui,/acknowledgedRevision\.current=null/);
assert.match(ui,/setBlocked\(true\)/);
assert.match(ui,/setBlocked\(false\)/);
assert.match(ui,/on HOLD/);
assert.match(ui,/Save not confirmed/);
assert.match(ui,/merchantEdited\.current&&!merchantExplicitReload\.current|unsaved_editor_changes/);
assert.match(ui,/No prices were overwritten/);
assert.match(ui,/workQuoteDraftReadPath\(submissionId\)/);
assert.match(ui,/prepareWorkQuoteUiSavePayload\(\{/);
assert.doesNotMatch(ui,/draftOrderCreate|discountCodeBasicCreate|localStorage|sessionStorage/);
const gate=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.requests.quote-draft.tsx',
 'utf8');
assert.match(gate,/workQuoteDraftFeatureReady\(env\)/);
assert.doesNotMatch(gate,/draftOrderCreate|draftOrderInvoiceSend/);
console.log('PASS HQ quote readback: stale ACK, revision mismatch, unsaved edits and uncertain reads fail closed; verified explicit reload preserves original gated draft route.');
