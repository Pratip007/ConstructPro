-- Migration 00010: Add 'inactive' to sites.status CHECK constraint
-- Required for soft-delete pattern used across all entity routes

ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_status_check;
ALTER TABLE sites ADD CONSTRAINT sites_status_check
  CHECK (status IN ('active', 'completed', 'upcoming', 'inactive'));
