-- INERT PROPOSAL ONLY: NOT AN APPLIED D1 MIGRATION.
-- WORK private artwork R2 budget reservation plan, source/test only.
-- DO NOT move into ../migrations/ or execute against remote D1.
-- Owner approval, real account-wide usage proof, deployment architecture,
-- quota recovery/retention review and separate migration release required.
-- This is a WORK APP ceiling, NOT an account-wide billable-usage cap.
CREATE TABLE IF NOT EXISTS jill_work_r2_quota_guard (
  shop TEXT PRIMARY KEY NOT NULL CHECK(shop='jill-work.myshopify.com'),
  month_key TEXT NOT NULL DEFAULT '0000-00'
    CHECK(length(month_key)=7 AND substr(month_key,5,1)='-'),
  lifetime_reserved_bytes INTEGER NOT NULL DEFAULT 0
    CHECK(typeof(lifetime_reserved_bytes)='integer'
      AND lifetime_reserved_bytes BETWEEN 0 AND 268435456),
  month_uploads INTEGER NOT NULL DEFAULT 0
    CHECK(typeof(month_uploads)='integer' AND month_uploads BETWEEN 0 AND 40),
  month_class_a INTEGER NOT NULL DEFAULT 0
    CHECK(typeof(month_class_a)='integer' AND month_class_a BETWEEN 0 AND 40),
  month_class_b INTEGER NOT NULL DEFAULT 0
    CHECK(typeof(month_class_b)='integer' AND month_class_b BETWEEN 0 AND 40),
  lifetime_reservations INTEGER NOT NULL DEFAULT 0
    CHECK(typeof(lifetime_reservations)='integer'
      AND lifetime_reservations BETWEEN 0 AND 100000),
  CHECK(month_uploads=month_class_a AND month_uploads=month_class_b)
) WITHOUT ROWID;

INSERT INTO jill_work_r2_quota_guard
  (shop,month_key,lifetime_reserved_bytes,month_uploads,
   month_class_a,month_class_b,lifetime_reservations)
VALUES ('jill-work.myshopify.com','0000-00',0,0,0,0,0)
ON CONFLICT(shop) DO NOTHING;

-- All accounting reservations are monotonic. No DELETE or manual refund.
-- Recovery after an ambiguous R2 write requires explicit audited procedure.
CREATE TRIGGER IF NOT EXISTS jill_work_r2_quota_no_delete
BEFORE DELETE ON jill_work_r2_quota_guard
BEGIN
  SELECT RAISE(ABORT,'work_r2_quota_delete_forbidden');
END;
CREATE TRIGGER IF NOT EXISTS jill_work_r2_quota_monotonic
BEFORE UPDATE ON jill_work_r2_quota_guard
WHEN NEW.shop<>OLD.shop
  OR NEW.month_key<OLD.month_key
  OR NEW.lifetime_reserved_bytes<OLD.lifetime_reserved_bytes
  OR NEW.lifetime_reservations<>OLD.lifetime_reservations+1
  OR (NEW.month_key=OLD.month_key AND
      (NEW.month_uploads<>OLD.month_uploads+1 OR
       NEW.month_class_a<>OLD.month_class_a+1 OR
       NEW.month_class_b<>OLD.month_class_b+1))
  OR (NEW.month_key>OLD.month_key AND
      (NEW.month_uploads<>1 OR NEW.month_class_a<>1 OR
       NEW.month_class_b<>1))
BEGIN
  SELECT RAISE(ABORT,'work_r2_quota_monotonic_violation');
END;
