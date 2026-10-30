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
