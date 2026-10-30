-- Migration 00009: Add approved_by to approval_requests
-- Tracks which admin approved/rejected each request for audit purposes

ALTER TABLE approval_requests
  ADD COLUMN approved_by BIGINT REFERENCES profiles(id);
