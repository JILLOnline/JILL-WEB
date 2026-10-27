// WORK HQ Owner recovery copy: source-only. Codes are hints, not
// permission to retry an uncertain write or publish a customer quote.
// Do not expose internal errors, D1 row contents or customer PII.
const READ=Object.freeze({
 stale_draft_readback:
  'The returned draft is older than your acknowledged Save. Keep these inputs and reload the verified draft; do not save again until its revision matches.',
 acknowledged_draft_not_visible:
  'A Save was acknowledged, but the saved draft was not found in this read. Stop and verify the original request and latest stored revision before any other write.',
 different_draft_revision:
  'A different verified draft revision exists. Check whether another tab or staff member updated it; choose Reload saved draft only if you intend to replace the current inputs.',
 unsaved_editor_changes:
  'Your newer unsaved edits are preserved. Choose Reload saved draft only if you want to replace them.',
 unverified_readback:
  'The saved draft could not be independently verified. Keep your current entries and check the signed request before trying again.',
 invalid_acknowledged_revision:
  'The confirmed Save revision is invalid. Stop; this request requires merchant verification.',
 invalid_editor_state:
  'The quote editor state is inconsistent. Leave the request unchanged and reopen it from the verified inbox.',
});
const SAVE=Object.freeze({
 commit_unconfirmed:
  'The database result is uncertain. Do not click Save again; reload the verified draft and reconcile its revision first.',
 draft_revision_changed:
  'The draft changed while you were editing. Reload and review the latest verified revision before preparing another Save.',
 source_revision_changed:
  'The original request changed. Reopen the verified request, then review all prices against its new items.',
 access_denied:
  'Your merchant session cannot make this change. Reauthenticate with an authorized Owner account.',
 quote_drafts_not_enabled:
  'Quote saving has not been enabled in this WORK release. Nothing was sent or invoiced.',
});
const genericRead='No trustworthy saved-draft readback was available. Leave prices unchanged and verify the latest request revision.';
const genericSave='The Save outcome is not verified. Do not repeat this write until the stored draft is independently checked.';
export function describeWorkQuoteReadbackHold(code){
 return Object.hasOwn(READ,code)?READ[code]:genericRead;
}
export function describeWorkQuoteSaveFailure(code){
 return Object.hasOwn(SAVE,code)?SAVE[code]:genericSave;
}
