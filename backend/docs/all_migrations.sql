-- Migration 00001: Profiles and Auth
-- Creates profiles and menu_allotments tables

CREATE TABLE profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','office','supervisor','employee')),
  email TEXT,
  phone TEXT,
  designation TEXT,
  assigned_site_id BIGINT,
  aadhaar_hash TEXT,
  aadhaar_last4 TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_allotments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id BIGINT REFERENCES profiles(id),
  menu_item_id TEXT NOT NULL,
  menu_name TEXT NOT NULL,
  menu_url TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration 00002: Core Tables
-- Creates companies, sites, banks, payment_modes tables

CREATE TABLE companies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gst_number TEXT,
  state_code TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  custom_fields JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sites (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company_id BIGINT REFERENCES companies(id),
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','upcoming')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE banks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bank_name TEXT NOT NULL,
  branch_name TEXT,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  account_type TEXT DEFAULT 'current',
  holder_name TEXT,
  opening_balance NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_modes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true
);
-- Migration 00003: Employee Tables
-- Creates employee_categories, employees, employee_sub_ids, site_tagging,
-- attendance, site_leaves, employee_ledger tables

CREATE TABLE employee_categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employees (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  father_name TEXT,
  dob DATE,
  religion TEXT,
  village TEXT,
  post TEXT,
  ps TEXT,
  district TEXT,
  pin TEXT,
  aadhaar_hash TEXT,
  aadhaar_last4 TEXT,
  uan TEXT,
  phone TEXT,
  whatsapp TEXT,
  emergency_contact TEXT,
  bank_name TEXT,
  account_holder TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  designation TEXT,
  category_id BIGINT REFERENCES employee_categories(id),
  working_positions TEXT,
  photo_url TEXT,
  current_site_id BIGINT REFERENCES sites(id),
  status TEXT DEFAULT 'active',
  profile_id BIGINT REFERENCES profiles(id),
  registered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_sub_ids (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  employee_id BIGINT REFERENCES employees(id),
  site_id BIGINT REFERENCES sites(id),
  type TEXT,
  rate NUMERIC(15,2),
  salary_basis TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_tagging (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT REFERENCES employees(id),
  site_id BIGINT REFERENCES sites(id),
  from_site TEXT,
  to_site TEXT,
  tagged_date DATE,
  tagged_by TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT REFERENCES employees(id),
  sub_id BIGINT REFERENCES employee_sub_ids(id),
  site_id BIGINT REFERENCES sites(id),
  month TEXT NOT NULL,
  present_days NUMERIC(5,2),
  ot_hours NUMERIC(5,2) DEFAULT 0,
  salary_basis TEXT,
  base_daily_wage NUMERIC(15,2),
  present_wage NUMERIC(15,2),
  ot_rate_per_hr NUMERIC(10,2),
  ot_amount NUMERIC(15,2),
  total_amount NUMERIC(15,2),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_leaves (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL,
  employee_id BIGINT REFERENCES employees(id),
  site_id BIGINT REFERENCES sites(id),
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  employee_id BIGINT REFERENCES employees(id),
  sub_id BIGINT REFERENCES employee_sub_ids(id),
  site_id BIGINT REFERENCES sites(id),
  type TEXT CHECK (type IN ('credit','debit')),
  particulars TEXT,
  credit_amount NUMERIC(15,2) DEFAULT 0,
  debit_amount NUMERIC(15,2) DEFAULT 0,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration 00004: Party Tables
-- Creates contractors, products, site_orders, site_order_items,
-- supervisors, supervisor_site_tagging, retailer_categories, retailers tables

CREATE TABLE contractors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  pan TEXT,
  gst_number TEXT,
  category TEXT,
  address TEXT,
  tds_applicable BOOLEAN DEFAULT false,
  tds_percent NUMERIC(5,2) DEFAULT 0,
  avatar_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  hsn TEXT,
  gst_percent NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  site_id BIGINT REFERENCES sites(id),
  contractor_id BIGINT REFERENCES contractors(id),
  base_amount NUMERIC(15,2),
  gst_amount NUMERIC(15,2),
  tds_amount NUMERIC(15,2),
  net_amount NUMERIC(15,2),
  gst_applied BOOLEAN DEFAULT false,
  tds_applicable BOOLEAN DEFAULT false,
  tds_percent NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT REFERENCES site_orders(id),
  name TEXT NOT NULL,
  hsn TEXT,
  unit TEXT,
  price NUMERIC(15,2),
  qty NUMERIC(15,3),
  base_total NUMERIC(15,2),
  gst_percent NUMERIC(5,2) DEFAULT 0,
  gst_amount NUMERIC(15,2),
  net_total NUMERIC(15,2)
);

CREATE TABLE supervisors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  employee_id BIGINT REFERENCES employees(id),
  name TEXT NOT NULL,
  contact TEXT,
  address TEXT,
  profile_id BIGINT REFERENCES profiles(id),
  assigned_site_id BIGINT REFERENCES sites(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE supervisor_site_tagging (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supervisor_id BIGINT REFERENCES supervisors(id),
  site_id BIGINT REFERENCES sites(id),
  from_site TEXT,
  to_site TEXT,
  tagged_date DATE,
  tagged_by TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE retailer_categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE retailers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  category_id BIGINT REFERENCES retailer_categories(id),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  gst_status TEXT CHECK (gst_status IN ('YES','NO')),
  gst_number TEXT,
  site_id BIGINT REFERENCES sites(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration 00005: Financial Tables
-- Creates retailer_bills, retailer_bill_items, purchase_orders,
-- purchase_order_items, invoices, balance_received, payments,
-- income_expenses, company_loans, company_emis tables

CREATE TABLE retailer_bills (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  inv_type TEXT CHECK (inv_type IN ('WITH','WITHOUT')),
  inv_no TEXT,
  category TEXT,
  retailer_name TEXT,
  retailer_id BIGINT REFERENCES retailers(id),
  site_id BIGINT REFERENCES sites(id),
  gst_applicable BOOLEAN DEFAULT false,
  gst_number TEXT,
  total_amount NUMERIC(15,2),
  paid_amount NUMERIC(15,2) DEFAULT 0,
  due_amount NUMERIC(15,2),
  status TEXT CHECK (status IN ('DUE','PAID')),
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE retailer_bill_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bill_id BIGINT REFERENCES retailer_bills(id),
  item TEXT NOT NULL,
  qty NUMERIC(15,3),
  unit TEXT,
  price NUMERIC(15,2),
  gst_percent NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(15,2),
  line_gst NUMERIC(15,2) DEFAULT 0,
  final_total NUMERIC(15,2),
  add_to_stock BOOLEAN DEFAULT false
);

CREATE TABLE purchase_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  site_id BIGINT REFERENCES sites(id),
  retailer_id BIGINT REFERENCES retailers(id),
  base_amount NUMERIC(15,2),
  gst_amount NUMERIC(15,2),
  net_amount NUMERIC(15,2),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT REFERENCES purchase_orders(id),
  product_id BIGINT REFERENCES products(id),
  name TEXT NOT NULL,
  hsn TEXT,
  unit TEXT,
  qty NUMERIC(15,3),
  price NUMERIC(15,2),
  gst_percent NUMERIC(5,2) DEFAULT 0,
  gst_amount NUMERIC(15,2),
  line_total NUMERIC(15,2)
);

CREATE TABLE invoices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  po_id BIGINT REFERENCES purchase_orders(id),
  company_id BIGINT REFERENCES companies(id),
  site_name TEXT,
  date DATE NOT NULL,
  base_amount NUMERIC(15,2),
  gst_amount NUMERIC(15,2),
  gross_amount NUMERIC(15,2),
  is_gst BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('paid','unpaid','partial')),
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE balance_received (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id BIGINT REFERENCES invoices(id),
  date DATE NOT NULL,
  entry_type TEXT CHECK (entry_type IN ('PAYMENT','TDS')),
  amount NUMERIC(15,2),
  tds_amount NUMERIC(15,2) DEFAULT 0,
  payment_method TEXT,
  reference_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  category TEXT CHECK (category IN ('employee','retailer','contractor','mobilization','supervisor_fund')),
  party_id BIGINT,
  party_name TEXT,
  party_type TEXT,
  site_id BIGINT REFERENCES sites(id),
  amount NUMERIC(15,2),
  tds_percentage NUMERIC(5,2) DEFAULT 0,
  tds_amount NUMERIC(15,2) DEFAULT 0,
  net_amount NUMERIC(15,2),
  payment_mode_id BIGINT REFERENCES payment_modes(id),
  bank_id BIGINT REFERENCES banks(id),
  status TEXT CHECK (status IN ('cleared','on_hold','cancelled')),
  remarks TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE income_expenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('Income','Expense')),
  bank_account TEXT,
  purpose TEXT,
  particulars TEXT,
  remark TEXT,
  amount NUMERIC(15,2),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE company_loans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  loan_id_external TEXT,
  bank TEXT,
  purpose TEXT,
  principal NUMERIC(15,2),
  interest_type TEXT CHECK (interest_type IN ('%','₹')),
  interest_value NUMERIC(10,2),
  tenure INT,
  total_payable NUMERIC(15,2),
  monthly_emi NUMERIC(15,2),
  due_date INT,
  remind_days INT DEFAULT 5,
  start_date DATE,
  status TEXT CHECK (status IN ('active','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE company_emis (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loan_id BIGINT REFERENCES company_loans(id),
  date DATE NOT NULL,
  ref_no TEXT,
  pay_bank TEXT,
  amount NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration 00006: Stock Tables
-- Creates stock_products, site_inventory, stock_transfers,
-- stock_transfer_items, damaged_stocks tables

CREATE TABLE stock_products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  hsn TEXT,
  category TEXT,
  gst_percent NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_inventory (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT REFERENCES stock_products(id),
  site_id BIGINT REFERENCES sites(id),
  quantity NUMERIC(15,3) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, site_id)
);

CREATE TABLE stock_transfers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  from_site_id BIGINT REFERENCES sites(id),
  to_site_id BIGINT REFERENCES sites(id),
  proof_url TEXT,
  status TEXT DEFAULT 'pending',
  remarks TEXT,
  created_by BIGINT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_transfer_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transfer_id BIGINT REFERENCES stock_transfers(id),
  product_id BIGINT REFERENCES stock_products(id),
  quantity NUMERIC(15,3),
  unit TEXT,
  remarks TEXT
);

CREATE TABLE damaged_stocks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  product_id BIGINT REFERENCES stock_products(id),
  site_id BIGINT REFERENCES sites(id),
  quantity NUMERIC(15,3),
  unit TEXT,
  reason TEXT,
  reported_by BIGINT REFERENCES profiles(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration 00007: Settings Tables
-- Creates terms_conditions, head_allotments, equipment_categories,
-- equipment_parties, equipment_site_assignments, vehicles,
-- vehicle_service_logs, approval_requests, activity_logs,
-- documents, document_folders tables

CREATE TABLE terms_conditions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  module TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE head_allotments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('Income','Expense')),
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE equipment_categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE equipment_parties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  address TEXT,
  category_id BIGINT REFERENCES equipment_categories(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE equipment_site_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  equipment_party_id BIGINT REFERENCES equipment_parties(id),
  site_id BIGINT REFERENCES sites(id),
  assigned_date DATE,
  released_date DATE,
  rate NUMERIC(15,2),
  rate_unit TEXT,
  status TEXT DEFAULT 'active',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vehicles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  vehicle_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT,
  make TEXT,
  model TEXT,
  year INT,
  owner_name TEXT,
  owner_contact TEXT,
  assigned_site_id BIGINT REFERENCES sites(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vehicle_service_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id BIGINT REFERENCES vehicles(id),
  service_date DATE NOT NULL,
  service_type TEXT,
  description TEXT,
  cost NUMERIC(15,2) DEFAULT 0,
  odometer_reading NUMERIC(10,2),
  next_service_date DATE,
  serviced_by TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  request_date TIMESTAMPTZ DEFAULT NOW(),
  source TEXT CHECK (source IN ('office','supervisor')),
  requester_id BIGINT REFERENCES profiles(id),
  requester_name TEXT,
  site_id BIGINT REFERENCES sites(id),
  module TEXT,
  action_type TEXT CHECK (action_type IN ('new_entry','edit','delete','status_toggle')),
  reference_id TEXT,
  amount NUMERIC(15,2),
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_remarks TEXT,
  admin_action_date TIMESTAMPTZ,
  ledger_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id BIGINT REFERENCES profiles(id),
  action TEXT NOT NULL,
  module TEXT,
  reference_id TEXT,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_folders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  parent_id BIGINT REFERENCES document_folders(id),
  site_id BIGINT REFERENCES sites(id),
  created_by BIGINT REFERENCES profiles(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  folder_id BIGINT REFERENCES document_folders(id),
  site_id BIGINT REFERENCES sites(id),
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by BIGINT REFERENCES profiles(id),
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add missing timestamp columns to ensure all tables comply with global constraint:
-- Every table has created_at TIMESTAMPTZ DEFAULT NOW() and updated_at TIMESTAMPTZ DEFAULT NOW()

-- Tables missing BOTH created_at and updated_at
ALTER TABLE payment_modes ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE payment_modes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE site_order_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE site_order_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE retailer_bill_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE retailer_bill_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE purchase_order_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE purchase_order_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE stock_transfer_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stock_transfer_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Tables missing only updated_at
ALTER TABLE menu_allotments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE site_tagging ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE attendance ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE site_leaves ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE employee_ledger ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE site_orders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE supervisors ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE supervisor_site_tagging ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE retailer_bills ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE balance_received ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE payments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE income_expenses ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE company_loans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE company_emis ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE vehicle_service_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE approval_requests ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE activity_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
-- Migration 00009: Add approved_by to approval_requests
-- Tracks which admin approved/rejected each request for audit purposes

ALTER TABLE approval_requests
  ADD COLUMN approved_by BIGINT REFERENCES profiles(id);
-- Migration 00010: Add 'inactive' to sites.status CHECK constraint
-- Required for soft-delete pattern used across all entity routes

ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_status_check;
ALTER TABLE sites ADD CONSTRAINT sites_status_check
  CHECK (status IN ('active', 'completed', 'upcoming', 'inactive'));
-- Migration 00011: Add 'cancelled'/'CANCELLED' to invoice and retailer_bills status CHECK
-- Required for soft-delete pattern used in sales module routes

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('paid', 'unpaid', 'partial', 'cancelled'));

ALTER TABLE retailer_bills DROP CONSTRAINT IF EXISTS retailer_bills_status_check;
ALTER TABLE retailer_bills ADD CONSTRAINT retailer_bills_status_check
  CHECK (status IN ('DUE', 'PAID', 'CANCELLED'));

-- Also fix payments status CHECK (Task 5 uses pending_approval/voided not in original)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('cleared', 'on_hold', 'cancelled', 'pending_approval', 'voided'));
