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
