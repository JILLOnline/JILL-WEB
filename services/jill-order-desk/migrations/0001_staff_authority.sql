-- WORK-only planning migration. Do NOT run against LIVE.
-- Staff IDs are Shopify numeric IDs stored as TEXT for stable precision.
-- Neither Shopify payments nor Google CustomOrderEvents are duplicated here.
-- D1 enforces foreign keys automatically; no PRAGMA foreign_keys switch.

CREATE TABLE IF NOT EXISTS jill_merchant_authority (
  shop TEXT PRIMARY KEY NOT NULL,
  environment TEXT NOT NULL CHECK(environment='WORK'),
  app_client_id TEXT NOT NULL,
  owner_staff_id TEXT NOT NULL,
  owner_bound_at TEXT NOT NULL,
  policy_version INTEGER NOT NULL DEFAULT 1 CHECK(policy_version>=1),
  CHECK(shop='jill-work.myshopify.com')
);

CREATE TABLE IF NOT EXISTS jill_merchant_grants (
  shop TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('administrator','order_manager','production','viewer')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  capabilities_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(capabilities_json)),
  issued_by_staff_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY(shop,staff_id),
  FOREIGN KEY(shop) REFERENCES jill_merchant_authority(shop) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS jill_merchant_audit (
  audit_id TEXT PRIMARY KEY NOT NULL,
  shop TEXT NOT NULL,
  actor_staff_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_staff_id TEXT,
  decision TEXT NOT NULL CHECK(decision IN ('allowed','denied')),
  policy_version INTEGER NOT NULL CHECK(policy_version>=1),
  happened_at TEXT NOT NULL,
  FOREIGN KEY(shop) REFERENCES jill_merchant_authority(shop) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_jill_grants_active
  ON jill_merchant_grants(shop,active,role);
CREATE INDEX IF NOT EXISTS idx_jill_audit_shop_time
  ON jill_merchant_audit(shop,happened_at);
