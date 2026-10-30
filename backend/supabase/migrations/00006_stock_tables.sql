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
