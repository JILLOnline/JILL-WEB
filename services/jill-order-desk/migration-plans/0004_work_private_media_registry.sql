-- INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION.
-- ONLY for isolated, in-memory SQLite verification under WORK CI.
-- DO NOT move to ../migrations/ or run wrangler d1 migrations apply
-- until WORK D1 ID, dedicated secret, retention & approval are certified.
-- No raw URLs, image bytes, customer PII, provider identities or tokens.
-- Pending source bindings are NOT authorization to preview any artwork.

CREATE TABLE IF NOT EXISTS jill_work_private_media_registry (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL
    CHECK(length(submission_id) BETWEEN 8 AND 128)
    CHECK(substr(submission_id,1,5)='jill:'),
  scope TEXT NOT NULL CHECK(scope IN ('request','item')),
  item_key TEXT NOT NULL DEFAULT '' CHECK(length(item_key)<=256),
  reference_index INTEGER NOT NULL
    CHECK(typeof(reference_index)='integer'
      AND reference_index BETWEEN 0 AND 19),
  reference_mac TEXT NOT NULL
    CHECK(length(reference_mac)=64)
    CHECK(reference_mac NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK(status IN ('pending_verification','quarantined','revoked')),
  created_at_ms INTEGER NOT NULL
    CHECK(typeof(created_at_ms)='integer' AND created_at_ms>0),
  updated_at_ms INTEGER NOT NULL
    CHECK(typeof(updated_at_ms)='integer' AND updated_at_ms>=created_at_ms),
  PRIMARY KEY (shop,submission_id,scope,item_key,reference_index),
  UNIQUE(reference_mac),
  FOREIGN KEY(shop) REFERENCES jill_merchant_authority(shop)
    ON DELETE RESTRICT,
  CHECK ((scope='request' AND item_key='') OR
         (scope='item' AND length(item_key)>0))
) WITHOUT ROWID;

-- Prevent silently swapping the canonical source reference or owner scope.
-- Rebinding a changed original source will require a separately reviewed
-- migration/reconciliation process, NEVER an UPDATE to the MAC.
CREATE TRIGGER jill_work_private_media_registry_immutable
BEFORE UPDATE OF shop,submission_id,scope,item_key,
  reference_index,reference_mac
ON jill_work_private_media_registry
BEGIN
  SELECT RAISE(ABORT,'immutable_work_media_reference');
END;

-- Quarantine/revoke instead of deleting the audit identity.
CREATE TRIGGER jill_work_private_media_registry_no_delete
BEFORE DELETE ON jill_work_private_media_registry
BEGIN
  SELECT RAISE(ABORT,'work_media_registry_delete_forbidden');
END;
