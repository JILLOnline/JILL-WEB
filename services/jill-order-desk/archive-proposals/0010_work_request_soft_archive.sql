-- SOURCE-ONLY WORK proposal. NEVER apply to remote D1 during a visual
-- release. Owner permission, fresh canonical source, explicit gate and
-- independent migration certification are required before activation.
-- "Remove" is a reversible view-level tombstone, NEVER a customer-data delete.
-- Only the signed request ID and audit metadata are stored. No PII/files/raw.
CREATE TABLE IF NOT EXISTS jill_work_request_archive (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL CHECK(length(submission_id) BETWEEN 8 AND 128),
  is_removed INTEGER NOT NULL CHECK(is_removed IN (0,1)),
  revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 100),
  last_operation_id TEXT NOT NULL CHECK(length(last_operation_id) BETWEEN 40 AND 80),
  updated_by_staff_id TEXT NOT NULL CHECK(length(updated_by_staff_id) BETWEEN 1 AND 40),
  updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>=1600000000000),
  PRIMARY KEY(shop,submission_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS jill_work_request_archive_operations (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  operation_id TEXT NOT NULL CHECK(length(operation_id) BETWEEN 40 AND 80),
  submission_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('remove','restore')),
  source_revision INTEGER NOT NULL CHECK(source_revision BETWEEN 1 AND 100),
  actor_staff_id TEXT NOT NULL CHECK(length(actor_staff_id) BETWEEN 1 AND 40),
  committed_at_ms INTEGER NOT NULL CHECK(committed_at_ms>=1600000000000),
  PRIMARY KEY(shop,operation_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS jill_work_request_archive_removed
  ON jill_work_request_archive(shop,is_removed);
