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
 body_sha256 TEXT NOT NULL CHECK(length(body_sha256)=64
   AND body_sha256 NOT GLOB '*[^0-9a-f]*'),
 -- A 256-bit possession secret is never stored in plaintext. Customer
 -- ownership requires a distinct verified Shopify JWT + matching proof.
 claim_sha256 TEXT NOT NULL CHECK(length(claim_sha256)=64
   AND claim_sha256 NOT GLOB '*[^0-9a-f]*'),
 contact_json TEXT NOT NULL CHECK(
   length(contact_json)<=8192 AND json_valid(contact_json)),
 state TEXT NOT NULL DEFAULT 'received' CHECK(
   state IN ('received','reviewing','waiting_customer','resolved')),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 100),
 -- Merchant status edits are concurrency-checked and auditable. These are
 -- server-verified Shopify online staff IDs, never browser-supplied actors.
 status_actor_staff_id TEXT NOT NULL DEFAULT '' CHECK(
  status_actor_staff_id='' OR (
    length(status_actor_staff_id) BETWEEN 1 AND 20 AND
    substr(status_actor_staff_id,1,1) GLOB '[1-9]' AND
    status_actor_staff_id NOT GLOB '*[^0-9]*'
  )),
 last_status_operation_id TEXT DEFAULT NULL CHECK(
  last_status_operation_id IS NULL OR (
    length(last_status_operation_id) BETWEEN 40 AND 110 AND
    last_status_operation_id LIKE 'jill:work:contact:status:%'
  )),
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>0),
 updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>=created_at_ms),
 owner_customer_gid TEXT DEFAULT NULL CHECK(
   owner_customer_gid IS NULL OR (
     length(owner_customer_gid) BETWEEN 24 AND 96 AND
     substr(owner_customer_gid,1,23)='gid://shopify/Customer/' AND
     substr(owner_customer_gid,24,1) GLOB '[1-9]' AND
     substr(owner_customer_gid,24) NOT GLOB '*[^0-9]*'
   )
 ),
 PRIMARY KEY(shop,ticket_id)
);
CREATE INDEX IF NOT EXISTS jill_work_contact_tickets_updated
 ON jill_work_contact_tickets(shop,updated_at_ms DESC);

-- Lookup is always scoped to the independently signed account JWT's GID.
CREATE INDEX IF NOT EXISTS jill_work_contact_tickets_account
 ON jill_work_contact_tickets(shop,owner_customer_gid,updated_at_ms DESC);

-- Immutable public-status audit. An initial "received" event and every
-- later status change are recorded by the DATABASE (not a best-effort
-- separate Node write). Never expose the staff ID or operation IDs to My JILL.
CREATE TABLE IF NOT EXISTS jill_work_contact_status_events (
 shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
 ticket_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 100),
 from_state TEXT DEFAULT NULL,
 to_state TEXT NOT NULL CHECK(to_state IN (
   'received','reviewing','waiting_customer','resolved')),
 actor_staff_id TEXT NOT NULL DEFAULT '',
 operation_id TEXT DEFAULT NULL,
 happened_at_ms INTEGER NOT NULL CHECK(happened_at_ms>0),
 PRIMARY KEY(shop,ticket_id,revision),
 FOREIGN KEY(shop,ticket_id) REFERENCES jill_work_contact_tickets(shop,ticket_id)
);
CREATE TRIGGER IF NOT EXISTS jill_contact_initial_event
AFTER INSERT ON jill_work_contact_tickets
BEGIN
 INSERT INTO jill_work_contact_status_events
 (shop,ticket_id,revision,from_state,to_state,actor_staff_id,operation_id,happened_at_ms)
 VALUES (NEW.shop,NEW.ticket_id,NEW.revision,NULL,NEW.state,'',NULL,NEW.created_at_ms);
END;
CREATE TRIGGER IF NOT EXISTS jill_contact_status_revision_guard
BEFORE UPDATE ON jill_work_contact_tickets
WHEN (
 (NEW.state<>OLD.state AND (
   NEW.revision<>OLD.revision+1 OR
   NEW.updated_at_ms<=OLD.updated_at_ms OR
   NEW.status_actor_staff_id='' OR
   NEW.last_status_operation_id IS NULL
 )) OR
 (NEW.state=OLD.state AND NEW.revision<>OLD.revision)
)
BEGIN SELECT RAISE(ABORT,'invalid_work_contact_status_revision'); END;
CREATE TRIGGER IF NOT EXISTS jill_contact_status_event
AFTER UPDATE OF state ON jill_work_contact_tickets
WHEN NEW.state<>OLD.state
BEGIN
 INSERT INTO jill_work_contact_status_events
 (shop,ticket_id,revision,from_state,to_state,actor_staff_id,operation_id,happened_at_ms)
 VALUES (NEW.shop,NEW.ticket_id,NEW.revision,OLD.state,NEW.state,
 NEW.status_actor_staff_id,NEW.last_status_operation_id,NEW.updated_at_ms);
END;

-- Contact conversation v1. Internal Owner-authenticated merchant posts only;
-- delivery means persisted to an exact claimed My JILL account, NOT email,
-- browser notification, Shopify Inbox, or customer read receipt.
CREATE TABLE IF NOT EXISTS jill_work_contact_messages (
 shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
 ticket_id TEXT NOT NULL,
 sequence INTEGER NOT NULL CHECK(sequence BETWEEN 1 AND 50),
 operation_id TEXT NOT NULL CHECK(
   length(operation_id)=57 AND
   operation_id LIKE 'jill:work:contact:msg:%'),
 actor_staff_id TEXT NOT NULL CHECK(
   length(actor_staff_id) BETWEEN 1 AND 20 AND
   substr(actor_staff_id,1,1) GLOB '[1-9]' AND
   actor_staff_id NOT GLOB '*[^0-9]*'),
 body_text TEXT NOT NULL CHECK(length(body_text) BETWEEN 1 AND 1000),
 body_sha256 TEXT NOT NULL CHECK(length(body_sha256)=64
   AND body_sha256 NOT GLOB '*[^0-9a-f]*'),
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>0),
 PRIMARY KEY(shop,ticket_id,sequence),
 UNIQUE(shop,operation_id),
 FOREIGN KEY(shop,ticket_id) REFERENCES jill_work_contact_tickets(shop,ticket_id)
);
CREATE INDEX IF NOT EXISTS jill_work_contact_messages_by_ticket
 ON jill_work_contact_messages(shop,ticket_id,sequence);
