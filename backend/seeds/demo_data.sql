-- =============================================================================
-- ATR ConstructPro — Demo Seed Data (REFERENCE)
-- =============================================================================
-- This file is a REFERENCE document. It shows the intended demo data in SQL
-- form. The actual seeding is performed by seed_demo.js via
-- supabase.from().insert() calls to avoid needing a raw SQL execution method.
--
-- ALL tables use BIGINT GENERATED ALWAYS AS IDENTITY for PKs.
-- Do NOT specify 'id' values in INSERT statements — PostgreSQL auto-generates them.
-- Use sub-selects on display_id / name to cross-reference parent rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. companies
-- -----------------------------------------------------------------------------
INSERT INTO companies (display_id, name, gst_number, state_code, phone, email, address, status)
VALUES
  ('COMP-001', 'ATR Construction',  '19AABCU9603R1ZN', 'WB', '9800000001', 'atr@atr.com',       'Dum Dum, Kolkata, WB',      'active'),
  ('COMP-002', 'Silvergate Infra',  '19BBDCS1234R5ZM', 'WB', '9800000002', 'sg@silvergate.com', 'Salt Lake, Kolkata, WB',   'active');

-- -----------------------------------------------------------------------------
-- 2. sites
-- -----------------------------------------------------------------------------
INSERT INTO sites (display_id, name, company_id, address, status)
VALUES
  ('SITE-001', 'Dum Dum Project',       (SELECT id FROM companies WHERE display_id = 'COMP-001'), 'Dum Dum, Kolkata',       'active'),
  ('SITE-002', 'Salt Lake Sector V',    (SELECT id FROM companies WHERE display_id = 'COMP-001'), 'Sector V, Salt Lake',   'active'),
  ('SITE-003', 'Rajarhat Township',     (SELECT id FROM companies WHERE display_id = 'COMP-002'), 'Rajarhat, Kolkata',     'active'),
  ('SITE-004', 'Howrah Bridge Repair',  (SELECT id FROM companies WHERE display_id = 'COMP-002'), 'Howrah, WB',            'upcoming'),
  ('SITE-005', 'Barrackpore Complex',   (SELECT id FROM companies WHERE display_id = 'COMP-001'), 'Barrackpore, WB',       'completed');

-- -----------------------------------------------------------------------------
-- 3. banks
-- -----------------------------------------------------------------------------
INSERT INTO banks (bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance, status)
VALUES
  ('State Bank of India', 'Dum Dum Branch',       '32145678901', 'SBIN0001234', 'Current', 'ATR Construction',  500000.00, 'active'),
  ('HDFC Bank',           'Salt Lake Branch',     '50100245678', 'HDFC0001567', 'Current', 'ATR Construction',  750000.00, 'active'),
  ('Punjab National Bank','Barrackpore Branch',   '0987654321',  'PUNB0009876', 'Savings', 'Silvergate Infra',  250000.00, 'active');

-- -----------------------------------------------------------------------------
-- 4. payment_modes
-- -----------------------------------------------------------------------------
INSERT INTO payment_modes (name, is_active)
VALUES
  ('NEFT', TRUE),
  ('UPI',  TRUE),
  ('Cash', TRUE);

-- -----------------------------------------------------------------------------
-- 5. employee_categories
-- -----------------------------------------------------------------------------
INSERT INTO employee_categories (name, description, status)
VALUES
  ('Mason',       'Masonry work',        'active'),
  ('Helper',      'General helper',      'active'),
  ('Electrician', 'Electrical work',     'active');

-- -----------------------------------------------------------------------------
-- 6. contractors
-- -----------------------------------------------------------------------------
INSERT INTO contractors (display_id, name, phone, pan, tds_applicable, tds_percent, status)
VALUES
  ('CONT-001', 'Rajesh Kumar', '9100000001', 'ABCPK1234F', TRUE,  2.00, 'active'),
  ('CONT-002', 'Sanjay Das',   '9100000002', 'DEFPD5678G', TRUE,  1.00, 'active'),
  ('CONT-003', 'Amit Singh',   '9100000003', NULL,         FALSE, NULL, 'active');

-- -----------------------------------------------------------------------------
-- 7. retailer_categories
-- -----------------------------------------------------------------------------
INSERT INTO retailer_categories (name, description, status)
VALUES
  ('Building Materials', 'Cement, sand, bricks, rods', 'active'),
  ('Electrical Supplies', 'Wires, switches, fittings',  'active');

-- -----------------------------------------------------------------------------
-- 8. retailers
-- -----------------------------------------------------------------------------
INSERT INTO retailers (display_id, category_id, name, phone, gst_status, gst_number, site_id, status)
VALUES
  ('RET-001', (SELECT id FROM retailer_categories WHERE name = 'Building Materials'),  'Bengal Cement House',   '9200000001', 'YES', '19BCHEM1234R1ZA', (SELECT id FROM sites WHERE display_id = 'SITE-001'), 'active'),
  ('RET-002', (SELECT id FROM retailer_categories WHERE name = 'Building Materials'),  'Eastern Hardware',      '9200000002', 'YES', '19EHRDW5678R2ZB', (SELECT id FROM sites WHERE display_id = 'SITE-002'), 'active'),
  ('RET-003', (SELECT id FROM retailer_categories WHERE name = 'Electrical Supplies'), 'Lightning Electricals', '9200000003', 'YES', '19LGTEL9012R3ZC', (SELECT id FROM sites WHERE display_id = 'SITE-003'), 'active'),
  ('RET-004', (SELECT id FROM retailer_categories WHERE name = 'Building Materials'),  'Local Sand Supplier',   '9200000004', 'NO',  NULL,             (SELECT id FROM sites WHERE display_id = 'SITE-001'), 'active'),
  ('RET-005', (SELECT id FROM retailer_categories WHERE name = 'Electrical Supplies'), 'Quick Plumbing',        '9200000005', 'NO',  NULL,             (SELECT id FROM sites WHERE display_id = 'SITE-002'), 'active');

-- -----------------------------------------------------------------------------
-- 9. stock_products
-- -----------------------------------------------------------------------------
INSERT INTO stock_products (display_id, name, unit, category, gst_percent, status)
VALUES
  ('SP-001', 'Cement',       'Bag',   'Building',   18.00, 'active'),
  ('SP-002', 'TMT Rod',      'KG',    'Building',   18.00, 'active'),
  ('SP-003', 'Sand',         'CFT',   'Building',    0.00, 'active'),
  ('SP-004', 'Bricks',       'Pcs',   'Building',    5.00, 'active'),
  ('SP-005', 'Electric Wire','Meter', 'Electrical', 18.00, 'active');

-- -----------------------------------------------------------------------------
-- 10. equipment_categories
-- -----------------------------------------------------------------------------
INSERT INTO equipment_categories (name, description, status)
VALUES
  ('Crane',     'Crane equipment',     'active'),
  ('Excavator', 'Excavator equipment', 'active');

-- -----------------------------------------------------------------------------
-- 11. head_allotments
-- -----------------------------------------------------------------------------
INSERT INTO head_allotments (name, type, description, status)
VALUES
  ('Site Expense',        'Expense', 'General site expenses',   'active'),
  ('Office Expense',      'Expense', 'Office overhead expenses','active'),
  ('Invoice Revenue',     'Income',  'Revenue from invoices',   'active'),
  ('Miscellaneous Income','Income',  'Other income sources',    'active');

-- -----------------------------------------------------------------------------
-- 12. terms_conditions
-- -----------------------------------------------------------------------------
INSERT INTO terms_conditions (title, content, module, status)
VALUES
  ('Payment Terms',  'Payment due within 30 days of invoice',    'invoice',        'active'),
  ('Delivery Terms', 'Delivery at site within 7 working days',   'purchase_order', 'active');

-- -----------------------------------------------------------------------------
-- 13. vehicles
-- -----------------------------------------------------------------------------
INSERT INTO vehicles (display_id, vehicle_number, vehicle_type, make, model, year, owner_name, owner_contact, assigned_site_id, status)
VALUES
  ('VEH-001', 'WB-26-1234', 'Truck', 'Tata', '407',  2022, 'ATR Construction', '9300000001', (SELECT id FROM sites WHERE display_id = 'SITE-001'), 'active'),
  ('VEH-002', 'WB-26-5678', 'JCB',   'JCB',  '3DX',  2023, 'Rented',           '9300000002', (SELECT id FROM sites WHERE display_id = 'SITE-003'), 'active');
