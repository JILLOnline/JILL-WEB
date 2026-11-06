import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeWorkQuoteReadbackHold as read,describeWorkQuoteSaveFailure as save}
 from '../services/jill-order-desk/work-quote-recovery-guidance.mjs';
for(const code of ['stale_draft_readback','acknowledged_draft_not_visible',
 'different_draft_revision','unverified_readback','invalid_editor_state']){
 const message=read(code);
 assert.ok(message.length>30);
 assert.doesNotMatch(message,/draft_(revision|readback)|source_revision|access_denied/);
 assert.doesNotMatch(message,/invoice sent|payment confirmed|save now/i);
}
assert.match(read('stale_draft_readback'),/older than your acknowledged Save/);
assert.match(read('acknowledged_draft_not_visible'),/Stop and verify/);
assert.match(read('different_draft_revision'),/another tab or staff member/);
assert.match(read('unsaved_editor_changes'),/unsaved edits are preserved/);
assert.match(save('commit_unconfirmed'),/Do not click Save again/);
assert.match(save('draft_revision_changed'),/Reload and review/);
assert.match(save('source_revision_changed'),/Reopen the verified request/);
assert.match(save('quote_drafts_not_enabled'),/not been enabled/);
assert.match(save('malicious_private_token_123'),/not verified/);
assert.doesNotMatch(save('malicious_private_token_123'),/malicious_private_token/);
assert.doesNotMatch(read('__proto__'),/function|prototype|Object/);
const source=readFileSync('services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx','utf8');
assert.match(source,/describeWorkQuoteReadbackHold\(check\.code\)/);
assert.match(source,/describeWorkQuoteSaveFailure\(saveFetcher\.data\.code\)/);
assert.match(source,/Saved draft readback is on HOLD/);
assert.match(source,/Save not confirmed/);
assert.match(source,/setBlocked\(true\)/);
assert.match(source,/acknowledgedRevision\.current=rev/);
assert.match(source,/if\(check\.state==="apply"&&projection\)/);
assert.doesNotMatch(source,/Save not confirmed \("/);
const route=readFileSync('services/jill-order-desk/app-home/app/routes/app.requests.quote-draft.tsx','utf8');
assert.match(route,/workQuoteDraftFeatureReady\(env\)/);
assert.doesNotMatch(route,/draftOrderCreate|draftOrderInvoiceSend/);
console.log('PASS HQ quote safe recovery copy: fail-closed saves, human guidance, no untrusted internal code leaks or Shopify side effects.');
