-- JILL WORK Contact customer replies V2 — SOURCE ONLY. NEVER apply without
-- Owner-approved WORK D1 schema preflight and a separately approved rollout.
-- Additive: the verified merchant-only v1 message ledger is UNCHANGED.
-- No LIVE / KEEP / storefront or Customer Account publishing.
CREATE TABLE IF NOT EXISTS jill_work_contact_customer_replies (
 shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
 ticket_id TEXT NOT NULL,
 reply_sequence INTEGER NOT NULL CHECK(reply_sequence BETWEEN 1 AND 50),
 operation_id TEXT NOT NULL CHECK(length(operation_id)=64 AND
   substr(operation_id,1,28)='jill:customer:contact:reply:'),
 actor_customer_gid TEXT NOT NULL CHECK(
   length(actor_customer_gid) BETWEEN 24 AND 96 AND
   substr(actor_customer_gid,1,23)='gid://shopify/Customer/' AND
   substr(actor_customer_gid,24,1) GLOB '[1-9]' AND
   substr(actor_customer_gid,24) NOT GLOB '*[^0-9]*'),
 body_text TEXT NOT NULL CHECK(length(body_text) BETWEEN 1 AND 500),
 body_sha256 TEXT NOT NULL CHECK(length(body_sha256)=64
   AND body_sha256 NOT GLOB '*[^0-9a-f]*'),
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>0),
 PRIMARY KEY(shop,ticket_id,reply_sequence),
 UNIQUE(shop,operation_id),
 FOREIGN KEY(shop,ticket_id) REFERENCES jill_work_contact_tickets(shop,ticket_id)
);
CREATE INDEX IF NOT EXISTS jill_work_contact_customer_replies_by_ticket
 ON jill_work_contact_customer_replies(shop,ticket_id,reply_sequence);

-- Never allow a Customer A reply to be committed on Customer B's ticket,
-- even by a buggy future handler. Cannot reply to an unclaimed or resolved
-- Contact, or inflate a thread beyond the combined 50-message bound.
CREATE TRIGGER IF NOT EXISTS jill_contact_customer_reply_owner_guard
BEFORE INSERT ON jill_work_contact_customer_replies
WHEN NOT EXISTS (
 SELECT 1 FROM jill_work_contact_tickets AS t
 WHERE t.shop=NEW.shop AND t.ticket_id=NEW.ticket_id
   AND t.owner_customer_gid=NEW.actor_customer_gid
   AND t.state IN ('received','reviewing','waiting_customer')
   AND (
    (SELECT COUNT(*) FROM jill_work_contact_messages AS m
     WHERE m.shop=NEW.shop AND m.ticket_id=NEW.ticket_id)
    +
    (SELECT COUNT(*) FROM jill_work_contact_customer_replies AS r
     WHERE r.shop=NEW.shop AND r.ticket_id=NEW.ticket_id)
   )<50
)
BEGIN SELECT RAISE(ABORT,'contact_customer_reply_not_authorized'); END;

-- No retroactive actor/body reassignment or chronology rewriting.
CREATE TRIGGER IF NOT EXISTS jill_contact_customer_reply_immutable
BEFORE UPDATE ON jill_work_contact_customer_replies
BEGIN SELECT RAISE(ABORT,'contact_customer_reply_immutable'); END;
CREATE TRIGGER IF NOT EXISTS jill_contact_customer_reply_no_delete
BEFORE DELETE ON jill_work_contact_customer_replies
BEGIN SELECT RAISE(ABORT,'contact_customer_reply_immutable'); END;
