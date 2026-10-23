-- SOURCE-ONLY WORK QA migration. NEVER run on LIVE or KEEP.
-- Contact Us is currently Shopify-native email; this table is NOT populated
-- until a separately certified Shopify app-proxy intake is published.
-- Restrict access to verified WORK HQ Owner/staff; do not publish through
-- Shopify app proxy reads, unauthenticated Google endpoints, or My JILL.
CREATE TABLE IF NOT EXISTS jill_work_contact_tickets (
 shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
 ticket_id TEXT NOT NULL CHECK(length(ticket_id)=49 AND
   substr(ticket_id,1,13)='jill:contact:'),
 source TEXT NOT NULL CHECK(source='shopify_contact_bridge'),
 body_sha256 TEXT NOT NULL CHECK(length(body_sha256)=64),
 contact_json TEXT NOT NULL CHECK(
   length(contact_json)<=8192 AND json_valid(contact_json)),
 state TEXT NOT NULL DEFAULT 'received' CHECK(
   state IN ('received','reviewing','waiting_customer','resolved')),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 100),
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>0),
 updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>=created_at_ms),
 owner_customer_gid TEXT DEFAULT NULL CHECK(owner_customer_gid IS NULL),
 PRIMARY KEY(shop,ticket_id)
);
CREATE INDEX IF NOT EXISTS jill_work_contact_tickets_updated
 ON jill_work_contact_tickets(shop,updated_at_ms DESC);
