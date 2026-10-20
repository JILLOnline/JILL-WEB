// Strictly offline WORK HQ presentation test. No runtime mutation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkWorkHqWorkspaceLayoutDraft,workspaceLayoutDraftManifest,
  WORKSPACE_LAYOUT_DRAFT_FILES,WORKSPACE_LAYOUT_DRAFT_BLOBS}
  from './work-hq-workspace-layout-draft.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {QUICK_PILL_POLISH_BLOBS} from './work-hq-quick-pill-polish-package.mjs';
import {ORDER_DETAILS_PROFILE} from './release-work-hq-order-details-owner.mjs';
import {INBOX_POLISH_PROFILE} from './release-work-hq-inbox-polish-owner.mjs';
import {QUICK_PILL_PROFILE} from './release-work-hq-quick-pill-owner.mjs';

const approved=checkWorkHqWorkspaceLayoutDraft();
assert.equal(approved.reviewed_files,13);
assert.equal(approved.status,'SOURCE_ONLY_HOLD');
assert.deepEqual([...WORKSPACE_LAYOUT_DRAFT_FILES].sort(),
  Object.keys(WORKSPACE_LAYOUT_DRAFT_BLOBS).sort());
const manifest=workspaceLayoutDraftManifest();
assert.equal(manifest.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual(Object.keys(manifest.files).sort(),[...WORKSPACE_LAYOUT_DRAFT_FILES].sort());
for(const digest of Object.values(manifest.files))assert.match(digest,/^[0-9a-f]{64}$/);
// Older source-only polished-pill edition and all spent releases are historical.
for(const path of Object.keys(QUICK_PILL_POLISH_BLOBS)){
  if(path.endsWith('request-detail.css')||
     path.endsWith('app.requests.$submissionId.tsx')||
     path.endsWith('WorkOriginalRequestDetails.tsx'))
    assert.notEqual(WORKSPACE_LAYOUT_DRAFT_BLOBS[path],QUICK_PILL_POLISH_BLOBS[path]);
  else assert.equal(WORKSPACE_LAYOUT_DRAFT_BLOBS[path],QUICK_PILL_POLISH_BLOBS[path]);
}
for(const old of [ORDER_DETAILS_PROFILE,INBOX_POLISH_PROFILE,QUICK_PILL_PROFILE]){
  assert.ok(old.receiptStem&&old.activationOperation&&old.base,
    'Historical release cannot be silently repurposed');
  assert.notEqual(old.changeScope,'source_only_workspace_layout_draft');
}
const base='services/jill-order-desk/app-home/app/';
const order=readFileSync(base+'components/WorkOriginalRequestDetails.tsx','utf8');
const quote=readFileSync(base+'components/WorkQuoteWorksheet.tsx','utf8');
const css=readFileSync(base+'styles/request-detail.css','utf8');
const detail=readFileSync(base+'routes/app.requests.$submissionId.tsx','utf8');
assert.match(order,/return <section className="jill-request__panel jill-workspace__overview"/);
assert.match(order,/return <details className="jill-request__panel jill-request__full jill-request__fold"/);
assert.match(quote,/return <details className="jill-request__panel jill-request__full jill-quote jill-request__fold"/);
assert.match(quote,/\/\/ Native disclosure keeps the quote form mounted while collapsed/);
assert.match(quote,/restoredActive\?"RESTORED DRAFT · NOT SENT":"NOT SAVED · NOT SENT"/);
assert.match(quote,/setBlocked\(true\)/);
assert.match(quote,/disabled=\{!canUseDraft\|\|!ready\}/);
assert.match(quote,/disabled=\{!canUseDraft\}/);
assert.match(detail,/WorkOrderDetails model=\{original\}/);
assert.match(css,/\.jill-request__fold\[open\]/);
console.log('PASS HQ WORK request workspace draft: static Order details, two closed disclosures, unobtrusive copy, guarded quote input state, legacy releases unmodified, no deployment.');
