-- JILL WORK: INERT SOURCE-ONLY admission-ledger proposal.
-- PHASE 26: NEVER import or apply this on remote D1 without new approval.
-- Intentionally OUTSIDE active migrations/ and prior 0004-0006 media plans.
-- This ledger stores NO raw payload, email, phone, IP, image or customer ID.
-- It is not the canonical Shopify paid order or Google QA request ledger.
CREATE TABLE IF NOT EXISTS jill_work_intake_ledger (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL
    CHECK(length(submission_id) BETWEEN 8 AND 128),
  payload_mac TEXT NOT NULL
    CHECK(length(payload_mac)=64 AND payload_mac NOT GLOB '*[^0-9a-f]*'),
  owner_binding_mac TEXT NOT NULL
    CHECK(length(owner_binding_mac)=64 AND owner_binding_mac NOT GLOB '*[^0-9a-f]*'),
  state TEXT NOT NULL DEFAULT 'reserved'
    CHECK(state IN ('reserved','forwarding','ambiguous','confirmed')),
  dispatch_attempts INTEGER NOT NULL DEFAULT 0
    CHECK(dispatch_attempts IN (0,1)),
  created_at_ms INTEGER NOT NULL
    CHECK(typeof(created_at_ms)='integer' AND created_at_ms>0),
  updated_at_ms INTEGER NOT NULL
    CHECK(typeof(updated_at_ms)='integer' AND updated_at_ms>=created_at_ms),
  PRIMARY KEY(shop,submission_id)
) WITHOUT ROWID;

-- No duplicate submit with changed payload or owner binding may replace it.
CREATE TRIGGER IF NOT EXISTS jill_work_intake_immutable
BEFORE UPDATE OF shop,submission_id,payload_mac,owner_binding_mac,created_at_ms
ON jill_work_intake_ledger
BEGIN
  SELECT RAISE(ABORT,'jill_work_intake_immutable');
END;

-- No automatic cleanup of accepted/ambiguous ledger rows.
CREATE TRIGGER IF NOT EXISTS jill_work_intake_no_delete
BEFORE DELETE ON jill_work_intake_ledger
BEGIN
  SELECT RAISE(ABORT,'jill_work_intake_no_delete');
END;

-- Exactly ONE dispatch attempt; an uncertain result is never blindly
-- re-sent. Only independent Google QA confirmation could transition
-- an ambiguous row to confirmed, with a separately approved adapter.
CREATE TRIGGER IF NOT EXISTS jill_work_intake_lifecycle
BEFORE UPDATE OF state,dispatch_attempts,updated_at_ms
ON jill_work_intake_ledger
WHEN NEW.updated_at_ms<=OLD.updated_at_ms
  OR NOT (
    (OLD.state='reserved' AND NEW.state='forwarding'
      AND OLD.dispatch_attempts=0 AND NEW.dispatch_attempts=1)
    OR (OLD.state='forwarding' AND NEW.state IN ('ambiguous','confirmed')
      AND OLD.dispatch_attempts=1 AND NEW.dispatch_attempts=1)
    OR (OLD.state='ambiguous' AND NEW.state='confirmed'
      AND OLD.dispatch_attempts=1 AND NEW.dispatch_attempts=1)
  )
BEGIN
  SELECT RAISE(ABORT,'jill_work_intake_lifecycle_forbidden');
END;
