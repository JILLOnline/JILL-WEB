-- INERT PROPOSAL ONLY. NOT AN APPLIED D1 MIGRATION.
-- WORK R2 object intent and private reference reconciliation, source-only.
-- Requires separately reviewed 0004 registry AND 0005 quota proposal.
-- No Worker upload, R2 PUT/GET/DELETE, customer delivery or live D1 writes.
-- Provider object keys are server-private random identifiers, never URLs.
CREATE TABLE IF NOT EXISTS jill_work_r2_object_intents (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('request','item')),
  item_key TEXT NOT NULL DEFAULT '' CHECK(length(item_key)<=256),
  reference_index INTEGER NOT NULL
    CHECK(typeof(reference_index)='integer' AND reference_index BETWEEN 0 AND 19),
  reference_mac TEXT NOT NULL
    CHECK(length(reference_mac)=64 AND reference_mac NOT GLOB '*[^0-9a-f]*'),
  reservation_id TEXT NOT NULL UNIQUE
    CHECK(length(reservation_id)=36
      AND reservation_id NOT GLOB '*[^0-9a-f-]*'),
  object_key TEXT NOT NULL UNIQUE
    CHECK(length(object_key)=55
      AND substr(object_key,1,19)='work/quarantine/v1/'
      AND substr(object_key,20) NOT GLOB '*[^0-9a-f-]*'),
  content_sha256 TEXT NOT NULL
    CHECK(length(content_sha256)=64 AND content_sha256 NOT GLOB '*[^0-9a-f]*'),
  byte_length INTEGER NOT NULL
    CHECK(typeof(byte_length)='integer' AND byte_length BETWEEN 20 AND 8388608),
  state TEXT NOT NULL DEFAULT 'reserved'
    CHECK(state IN ('reserved','ambiguous','quarantined_unlinked','revoked')),
  created_at_ms INTEGER NOT NULL
    CHECK(typeof(created_at_ms)='integer' AND created_at_ms>0),
  updated_at_ms INTEGER NOT NULL
    CHECK(typeof(updated_at_ms)='integer' AND updated_at_ms>=created_at_ms),
  PRIMARY KEY(shop,submission_id,scope,item_key,reference_index),
  FOREIGN KEY(shop,submission_id,scope,item_key,reference_index)
    REFERENCES jill_work_private_media_registry
    (shop,submission_id,scope,item_key,reference_index)
    ON DELETE RESTRICT,
  FOREIGN KEY(shop) REFERENCES jill_work_r2_quota_guard(shop)
    ON DELETE RESTRICT,
  CHECK ((scope='request' AND item_key='') OR
         (scope='item' AND length(item_key)>0))
) WITHOUT ROWID;

-- The registry can only serve as an inert pending original-source binding.
-- Comparing immutable MAC prevents copying artwork between request slots.
CREATE TRIGGER IF NOT EXISTS jill_work_r2_object_intent_source
BEFORE INSERT ON jill_work_r2_object_intents
WHEN NOT EXISTS (
  SELECT 1 FROM jill_work_private_media_registry AS r
  WHERE r.shop=NEW.shop AND r.submission_id=NEW.submission_id
    AND r.scope=NEW.scope AND r.item_key=NEW.item_key
    AND r.reference_index=NEW.reference_index
    AND r.reference_mac=NEW.reference_mac
    AND r.status='pending_verification'
)
BEGIN
  SELECT RAISE(ABORT,'work_r2_object_source_binding_unverified');
END;

-- An intent is never automatically replaced, even after a failed PUT.
CREATE TRIGGER IF NOT EXISTS jill_work_r2_object_intent_immutable
BEFORE UPDATE OF shop,submission_id,scope,item_key,reference_index,
  reference_mac,reservation_id,object_key,content_sha256,byte_length,
  created_at_ms
ON jill_work_r2_object_intents
BEGIN
  SELECT RAISE(ABORT,'work_r2_object_intent_immutable');
END;
CREATE TRIGGER IF NOT EXISTS jill_work_r2_object_intent_no_delete
BEFORE DELETE ON jill_work_r2_object_intents
BEGIN
  SELECT RAISE(ABORT,'work_r2_object_intent_delete_forbidden');
END;

-- This database state is NOT an attestation. Only separately audited
-- provider HEAD + Owner auth could ever allow server-side promotion.
-- No state, including quarantined_unlinked, permits download or preview.
CREATE TRIGGER IF NOT EXISTS jill_work_r2_object_intent_lifecycle
BEFORE UPDATE OF state,updated_at_ms ON jill_work_r2_object_intents
WHEN NEW.updated_at_ms<=OLD.updated_at_ms
  OR NOT (
    (OLD.state='reserved' AND NEW.state IN
       ('ambiguous','quarantined_unlinked','revoked'))
    OR (OLD.state IN ('ambiguous','quarantined_unlinked')
        AND NEW.state='revoked')
  )
BEGIN
  SELECT RAISE(ABORT,'work_r2_object_intent_lifecycle_forbidden');
END;
