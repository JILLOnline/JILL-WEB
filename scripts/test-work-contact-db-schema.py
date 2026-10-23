"""Offline SQLite check of the WORK-only Contact Us D1 migration.
No Cloudflare bindings, network calls, user data or external DB writes.
"""
import sqlite3
from pathlib import Path

sql = Path("services/jill-order-desk/migrations/0004_work_contact_tickets_source_only.sql").read_text()
db = sqlite3.connect(":memory:")
db.executescript(sql)
shop = "jill-work.myshopify.com"
ticket = "jill:contact:11111111-2222-4333-8444-555555555555"
body = '{"ticket_id":"' + ticket + '","reason":"custom"}'
columns = ("shop,ticket_id,source,body_sha256,claim_sha256,contact_json,"
           "state,revision,created_at_ms,updated_at_ms,owner_customer_gid")
values = (shop,ticket,"shopify_contact_bridge","a"*64,"b"*64,body,
          "received",1,1791800000000,1791800000000,None)
query = f"INSERT INTO jill_work_contact_tickets ({columns}) VALUES ({','.join('?'*11)})"
db.execute(query, values)
db.commit()
assert db.execute("SELECT COUNT(*) FROM jill_work_contact_tickets").fetchone()[0] == 1
assert db.execute("SELECT revision,from_state,to_state,actor_staff_id FROM "
                  "jill_work_contact_status_events").fetchone() == (1,None,"received","")

claim_first = db.execute("UPDATE jill_work_contact_tickets SET owner_customer_gid=? "
           "WHERE shop=? AND ticket_id=? AND owner_customer_gid IS NULL "
           "AND claim_sha256=? AND created_at_ms>=?",
           ("gid://shopify/Customer/111",shop,ticket,"b"*64,1791700000000))
assert claim_first.rowcount == 1
"claim_second = db.execute("UPDATE jill_work_contact_tickets SET owner_customer_gid=? "
           "WHERE shop=? AND ticket_id=? AND owner_customer_gid IS NULL "
           "AND claim_sha256=? AND created_at_ms>=?",
           ("gid://shopify/Customer/222",shop,ticket,"b"*64,1791700000000))
assert claim_second.rowcount == 0, "a second customer must never overwrite claimed owner"
assert db.execute("SELECT owner_customer_gid FROM jill_work_contact_tickets").fetchone()[0] == "gid://shopify/Customer/111"

def rejected(row):
    try:
        db.execute(query, row)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"Expected a D1/SQLite schema constraint refusal for {row[1]}")

rejected((shop,ticket,"shopify_contact_bridge","a"*64,"b"*64,body,
          "received",1,1791800000000,1791800000000,None))
rejected((shop,"not-a-uuid","shopify_contact_bridge","a"*64,"b"*64,body,
          "received",1,1791800000000,1791800000000,None))
rejected((shop,"jill:contact:22222222-2222-4333-8444-555555555555",
          "shopify_contact_bridge","a"*64,"b"*63,body,
          "received",1,1791800000000,1791800000000,None))
rejected((shop,"jill:contact:33333333-2222-4333-8444-555555555555",
          "shopify_contact_bridge","a"*64,"b"*64,body,
          "paid",1,1791800000000,1791800000000,None))
rejected((shop,"jill:contact:44444444-2222-4333-8444-555555555555",
          "shopify_contact_bridge","a"*64,"b"*64,body,
          "received",1,1791800000000,1791800000000,
          "gid://shopify/Customer/OTHER"))
rejected((shop,"jill:contact:55555555-2222-4333-8444-555555555555",
          "shopify_contact_bridge","a"*64,"b"*64,"not-json",
          "received",1,1791800000000,1791800000000,None))
assert db.execute("SELECT COUNT(*) FROM jill_work_contact_tickets").fetchone()[0] == 1
assert db.execute("SELECT COUNT(*) FROM jill_work_contact_status_events").fetchone()[0] == 1
# Audit is inserted atomically by a database trigger on every valid status
# change, never as an optional separate application write.
op = "jill:work:contact:status:11111111-2222-4333-8444-555555555555"
db.execute("UPDATE jill_work_contact_tickets SET state=?,revision=revision+1,"
           "updated_at_ms=?,status_actor_staff_id=?,last_status_operation_id=? "
           "WHERE shop=? AND ticket_id=? AND revision=? AND state=?",
           ("reviewing",1791800000001,"111",op,shop,ticket,1,"received"))
assert db.execute("SELECT revision,from_state,to_state,actor_staff_id,operation_id "
                  "FROM jill_work_contact_status_events WHERE revision=2").fetchone() == (
                    2,"received","reviewing","111",op)
assert db.execute("SELECT COUNT(*) FROM jill_work_contact_status_events").fetchone()[0] == 2
try:
    db.execute("UPDATE jill_work_contact_tickets SET state=?,updated_at_ms=? "
               "WHERE shop=? AND ticket_id=?",
               ("resolved",1791800000002,shop,ticket))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("status must not change without a revision and actor")
assert db.execute("SELECT state,revision FROM jill_work_contact_tickets").fetchone() == ("reviewing",2)
# Guest->customer ownership association cannot create fake status history.
assert db.execute("SELECT COUNT(*) FROM jill_work_contact_status_events").fetchone()[0] == 2
assert db.execute("SELECT name FROM sqlite_master WHERE type='index' "
                  "AND name='jill_work_contact_tickets_account'").fetchone()
db.close()
print("PASS WORK Contact D1 migration in memory: hashed claim, exact owner, atomic audited status timeline, bounded JSON, invalid rows rejected.")
