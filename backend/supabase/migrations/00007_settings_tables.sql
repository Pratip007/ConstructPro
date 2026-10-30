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
