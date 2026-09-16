-- Project lifecycle schema (D1 / SQLite).
-- Existing intake_requests remains untouched.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('commercial', 'ops', 'engineering', 'finance', 'collections'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK(segment IN ('hyperscale', 'colo', 'industrial'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  project_code TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  site_name TEXT NOT NULL,
  deal_name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('intake', 'engineering', 'sourcing', 'invoicing')),
  status TEXT NOT NULL CHECK(status IN ('active', 'on_hold', 'cancelled')),
  quoted_revenue REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  customer_requested_delivery_date TEXT NOT NULL,
  commercial_owner_id TEXT NOT NULL REFERENCES users(id),
  ops_owner_id TEXT NOT NULL REFERENCES users(id),
  quote_frozen_at TEXT,
  bom_locked INTEGER NOT NULL DEFAULT 0,
  requestor_name TEXT NOT NULL DEFAULT '',
  requestor_team TEXT NOT NULL DEFAULT '',
  problem_statement TEXT NOT NULL DEFAULT '',
  expected_outcome TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spec_fields (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  section TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  unit TEXT,
  status TEXT NOT NULL CHECK(status IN ('confirmed', 'conflicting', 'unresolved')) DEFAULT 'unresolved',
  owner_id TEXT REFERENCES users(id),
  source TEXT NOT NULL DEFAULT '',
  conflict_summary TEXT NOT NULL DEFAULT '',
  required INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, field_key)
);

CREATE TABLE IF NOT EXISTS quote_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version INTEGER NOT NULL,
  frozen_at TEXT NOT NULL,
  materials REAL NOT NULL,
  labor REAL NOT NULL,
  engineering REAL NOT NULL,
  freight REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS bom_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  spec_field_id TEXT REFERENCES spec_fields(id),
  depends_on_field_key TEXT,
  sku TEXT NOT NULL,
  description TEXT NOT NULL,
  cost_category TEXT NOT NULL CHECK(cost_category IN ('materials', 'labor', 'engineering', 'freight')),
  qty REAL NOT NULL,
  uom TEXT NOT NULL,
  unit_quoted_cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  typical_lead_time_days INTEGER NOT NULL,
  terms TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL REFERENCES projects(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  document_type TEXT NOT NULL CHECK(document_type IN ('po', 'wo')) DEFAULT 'po',
  status TEXT NOT NULL CHECK(status IN ('ordered', 'confirmed', 'in_production', 'shipped', 'received', 'cancelled')),
  issued_at TEXT NOT NULL,
  lead_time_days INTEGER NOT NULL,
  promised_ship_date TEXT NOT NULL,
  total_amount REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS po_lines (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES purchase_orders(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  bom_item_id TEXT REFERENCES bom_items(id),
  description TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_cost REAL NOT NULL,
  cost_category TEXT NOT NULL CHECK(cost_category IN ('materials', 'labor', 'engineering', 'freight'))
);

CREATE TABLE IF NOT EXISTS labor_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  committed_at TEXT NOT NULL,
  role TEXT NOT NULL,
  hours REAL NOT NULL,
  rate REAL NOT NULL,
  amount REAL NOT NULL,
  cost_category TEXT NOT NULL CHECK(cost_category IN ('materials', 'labor', 'engineering', 'freight')) DEFAULT 'labor',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  po_id TEXT REFERENCES purchase_orders(id),
  invoice_number TEXT NOT NULL,
  invoiced_at TEXT NOT NULL,
  paid_at TEXT,
  amount REAL NOT NULL,
  cost_category TEXT NOT NULL CHECK(cost_category IN ('materials', 'labor', 'engineering', 'freight')),
  status TEXT NOT NULL CHECK(status IN ('invoiced', 'paid'))
);

CREATE TABLE IF NOT EXISTS customer_invoices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  invoice_number TEXT NOT NULL,
  billed_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  amount REAL NOT NULL,
  milestone TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('billed', 'partial', 'paid', 'disputed'))
);

CREATE TABLE IF NOT EXISTS ar_payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES customer_invoices(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  received_at TEXT NOT NULL,
  amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS classification_pins (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  domain TEXT NOT NULL CHECK(domain IN ('cost', 'ar')),
  pinned_class TEXT CHECK(pinned_class IN ('risk', 'timing', 'anomaly', 'improvement')),
  pin_reason TEXT NOT NULL DEFAULT '',
  pinned_by TEXT REFERENCES users(id),
  UNIQUE(project_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_spec_fields_project ON spec_fields(project_id, status);
CREATE INDEX IF NOT EXISTS idx_po_project ON purchase_orders(project_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_labor_project ON labor_entries(project_id, committed_at);
CREATE INDEX IF NOT EXISTS idx_ar_project ON customer_invoices(project_id, due_at);

CREATE VIEW IF NOT EXISTS v_project_readiness AS
SELECT
  p.id AS project_id,
  p.project_code,
  SUM(CASE WHEN f.required = 1 AND f.status = 'confirmed' AND f.owner_id IS NOT NULL AND f.value != '' THEN 1 ELSE 0 END) AS confirmed_required,
  SUM(CASE WHEN f.required = 1 THEN 1 ELSE 0 END) AS total_required
FROM projects p
LEFT JOIN spec_fields f ON f.project_id = p.id
GROUP BY p.id, p.project_code;
