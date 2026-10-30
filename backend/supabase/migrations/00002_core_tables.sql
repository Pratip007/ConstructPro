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
