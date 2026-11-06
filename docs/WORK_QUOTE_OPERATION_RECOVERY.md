# WORK quote operation recovery — source-only

An uncertain Save must retain its original operation until an authenticated
read settles that operation. A verified draft revision alone is insufficient.
This corrects the revision-4 readback accepting an unacknowledged revision-5 Save.

## Owners and protocol

- Existing D1 quote drafts and operation receipts remain the only durable
  authority. No schema, migration, financial state or flag changes.
- The existing Owner GET accepts an optional exact `operation_id` and
  `expected_draft_revision` pair. Authentication, same-origin validation,
  exact signed source and stored quote verification still precede success.
- One joined SQL SELECT reads current draft and matching receipt in the same
  snapshot. A matching receipt identifies `committed`; no receipt while CAS
  has already advanced identifies `not_applied` (the old operation cannot
  subsequently pass its expected revision). An older/missing row or absent
  receipt at the expected revision is `unresolved`. Invalid receipts hold.
- A committed operation can be reconciled after later edits by another tab;
  the independently verified current draft must be at least its revision.
- The browser uses an opaque authenticated Owner partition and request ID.
  One storage adapter keeps only operation UUID, expected revision and source
  revision. Web Locks serialize competing reservations. No quote contents,
  name, email, artwork, credentials or financial data are stored locally.
- The same marker survives component remount, navigation and ordinary page
  refresh. Another authenticated Owner has a different partition. Marker
  removal requires the exact operation/revision proof after restore policy
  approval, under the same cross-tab lock.
- Save acknowledgments retain the marker. Reload retries are read-only and
  keep the same operation ID. Neither uncertain writes nor remounts trigger
  an automatic POST retry or generate a replacement submitted operation.

## Failure behavior and practical limits

Unavailable Web Locks/storage, malformed metadata, wrong-operation proof,
old/missing drafts, changed source, revoked authorization and failed readback
block saving. Existing inputs remain intact. There is no timeout that silently
expires an unresolved marker. If a write never reached D1 and no later write
has advanced CAS, readback cannot prove terminal failure; it remains on HOLD
for Owner reconciliation. This intentionally avoids guessing that a delayed
write failed. Clearing browser site data also removes browser recovery metadata;
server CAS/unique receipts remain the backstop. Do not certify that case as
durable browser recovery. Broader command-intent/cancellation semantics require
their own reviewed source/schema scope.

## Validation

- `test-work-quote-save-single-flight.mjs`: 50 rapid reservations, 20 competing
  tabs, retained metadata on remount, Owner partition, exact release and corrupt
  or unavailable storage/lock denial.
- `test-work-quote-reload-revision-guard.mjs`: uncertain operation blocks old,
  missing and unrelated reads even after explicit Reload.
- `test-work-quote-http-sqlite-roundtrip.mjs`: actual handlers and SQL, delayed
  transaction, stale authenticated read, eventual commit, competing CAS winner,
  exact receipts, source/Owner/origin denial, no writes from reconciliation.
- `test-work-quote-recovery-mounted.mjs`: actual React worksheet and synthetic
  Router transport, feature-OFF zero calls, 50 rapid clicks, uncertain Save,
  older read, destruction/remount, eventual exact receipt, ACK-only hold,
  wrong-operation denial and Owner isolation.

These are local/synthetic source tests. Deployed Owner Save→leave→reload,
browser storage/lock compatibility, current installed source identity and
authenticated customer acceptance remain separate WORK gates.
