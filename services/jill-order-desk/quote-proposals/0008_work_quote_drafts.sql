-- JILL WORK — INERT SOURCE-ONLY draft-quote D1 schema proposal.
-- DO NOT migrate WORK remote D1 or deploy any route without separate owner approval.
-- OUTSIDE active migrations/. No email, phone, address, customer token,
-- raw custom-order payload, reference URL, asset, session or credentials.
-- This is NOT a Shopify order, customer approval, invoice or payment record.
CREATE TABLE IF NOT EXISTS jill_work_quote_drafts (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL CHECK(length(submission_id) BETWEEN 8 AND 128),
  draft_revision INTEGER NOT NULL CHECK(draft_revision BETWEEN 1 AND 100),
  source_revision INTEGER NOT NULL CHECK(source_revision BETWEEN 1 AND 100),
  source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64
    AND source_sha256 NOT GLOB '*[^0-9a-f]*'),
  quote_sha256 TEXT NOT NULL CHECK(length(quote_sha256)=64
    AND quote_sha256 NOT GLOB '*[^0-9a-f]*'),
  quote_json TEXT NOT NULL CHECK(json_valid(quote_json)
    AND length(quote_json) BETWEEN 20 AND 25000),
  total_cents INTEGER NOT NULL CHECK(total_cents BETWEEN 0 AND 100000000),
  currency TEXT NOT NULL CHECK(currency='USD'),
  state TEXT NOT NULL CHECK(state='draft'),
  last_operation_id TEXT NOT NULL CHECK(length(last_operation_id) BETWEEN 40 AND 80),
  created_at_ms INTEGER NOT NULL CHECK(typeof(created_at_ms)='integer'
    AND created_at_ms>0),
  updated_at_ms INTEGER NOT NULL CHECK(typeof(updated_at_ms)='integer'
    AND updated_at_ms>=created_at_ms),
  PRIMARY KEY(shop,submission_id)
) WITHOUT ROWID;

-- Every successful save is linked to its unique idempotency operation.
-- The two prepared statements MUST execute in one atomic D1 batch.
-- Unknown-commit outcomes require read-only reconciliation, NOT resubmit.
CREATE TABLE IF NOT EXISTS jill_work_quote_draft_operations (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  operation_id TEXT NOT NULL CHECK(length(operation_id) BETWEEN 40 AND 80),
  submission_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL CHECK(draft_revision BETWEEN 1 AND 100),
  quote_sha256 TEXT NOT NULL CHECK(length(quote_sha256)=64
    AND quote_sha256 NOT GLOB '*[^0-9a-f]*'),
  created_at_ms INTEGER NOT NULL CHECK(typeof(created_at_ms)='integer'
    AND created_at_ms>0),
  PRIMARY KEY(shop,operation_id),
  FOREIGN KEY(shop,submission_id)
    REFERENCES jill_work_quote_drafts(shop,submission_id)
) WITHOUT ROWID;
