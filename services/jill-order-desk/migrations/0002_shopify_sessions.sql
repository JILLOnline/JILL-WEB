-- Separate encrypted Shopify SDK sessions from JILL staff permissions.
-- Apply ONLY to the existing, isolated jill-order-desk-work D1 database.
-- Session payload includes privileged Shopify tokens; only AES-GCM ciphertext
-- is persisted. Separate WORK secret is required before any SDK host activation.
CREATE TABLE IF NOT EXISTS jill_shopify_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  payload_ciphertext TEXT NOT NULL,
  payload_nonce TEXT NOT NULL,
  expires_at_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jill_shopify_sessions_shop
  ON jill_shopify_sessions(shop,expires_at_ms);
