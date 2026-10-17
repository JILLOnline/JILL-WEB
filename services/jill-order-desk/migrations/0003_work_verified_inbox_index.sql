-- WORK-ONLY read projection. Google QA remains the canonical authority.
-- Run migration only on jill-order-desk-work D1 after read-only DB ID audit.
-- Never store raw Custom Order payloads, email, shipping contacts, files,
-- Shopify sessions or secrets in this single-row derived index.
-- Generation is incremented by every confirmed WORK merchant write to
-- prevent a stale in-flight Google read from overwriting a newer revision.
CREATE TABLE IF NOT EXISTS jill_work_verified_inbox_index (
  shop TEXT PRIMARY KEY NOT NULL
    CHECK(shop='jill-work.myshopify.com'),
  generation INTEGER NOT NULL DEFAULT 0 CHECK(generation>=0),
  verified_payload_json TEXT
    CHECK(verified_payload_json IS NULL OR json_valid(verified_payload_json)),
  verified_at_ms INTEGER NOT NULL DEFAULT 0 CHECK(verified_at_ms>=0),
  expires_at_ms INTEGER NOT NULL DEFAULT 0 CHECK(expires_at_ms>=0)
);
INSERT INTO jill_work_verified_inbox_index
  (shop,generation,verified_payload_json,verified_at_ms,expires_at_ms)
  VALUES ('jill-work.myshopify.com',0,NULL,0,0)
  ON CONFLICT(shop) DO NOTHING;
