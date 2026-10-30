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
