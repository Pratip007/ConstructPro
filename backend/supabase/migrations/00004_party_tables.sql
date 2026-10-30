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
