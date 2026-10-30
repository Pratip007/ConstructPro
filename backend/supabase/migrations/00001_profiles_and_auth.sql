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
