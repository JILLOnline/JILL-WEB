-- REVIEWED SOURCE PROPOSAL ONLY. Outside migrations/: no remote activation.
-- Terms are private, owner-scoped records. No JWT, email, payment data or raw
-- intake/artwork. Shipping address is represented by a Shopify-verified hash.
CREATE TABLE jill_work_quote_heads (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>=0 AND revision<=100),
  operation_id TEXT NOT NULL,
  PRIMARY KEY(shop,submission_id)
) WITHOUT ROWID;
CREATE TABLE jill_work_quote_publications (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 100),
  operation_id TEXT NOT NULL,
  customer_gid TEXT NOT NULL,
  source_revision INTEGER NOT NULL,
  source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64),
  quote_sha256 TEXT NOT NULL CHECK(length(quote_sha256)=64),
  terms_json TEXT NOT NULL CHECK(json_valid(terms_json) AND length(terms_json)<=25000),
  staff_id TEXT NOT NULL,
  published_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms>published_at_ms),
  PRIMARY KEY(shop,submission_id,revision),
  UNIQUE(shop,operation_id)
) WITHOUT ROWID;
CREATE TABLE jill_work_quote_acceptances (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL,
  quote_revision INTEGER NOT NULL,
  quote_sha256 TEXT NOT NULL,
  customer_gid TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  accepted_at_ms INTEGER NOT NULL,
  PRIMARY KEY(shop,submission_id),
  UNIQUE(shop,operation_id),
  FOREIGN KEY(shop,submission_id,quote_revision)
    REFERENCES jill_work_quote_publications(shop,submission_id,revision)
) WITHOUT ROWID;
CREATE TABLE jill_work_commerce_intents (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('accepted_pending_event','event_confirmed',
    'creating_draft','needs_reconciliation','draft_linked','quarantined')),
  draft_gid TEXT,
  PRIMARY KEY(shop,submission_id),
  UNIQUE(shop,operation_id),
  FOREIGN KEY(shop,submission_id) REFERENCES jill_work_quote_acceptances(shop,submission_id)
) WITHOUT ROWID;
CREATE TABLE jill_work_commerce_links (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL,
  draft_gid TEXT NOT NULL,
  order_gid TEXT,
  quote_sha256 TEXT NOT NULL,
  PRIMARY KEY(shop,submission_id),
  UNIQUE(shop,draft_gid),
  UNIQUE(shop,order_gid),
  FOREIGN KEY(shop,submission_id) REFERENCES jill_work_quote_acceptances(shop,submission_id)
) WITHOUT ROWID;
