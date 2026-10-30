-- Add missing timestamp columns to ensure all tables comply with global constraint:
-- Every table has created_at TIMESTAMPTZ DEFAULT NOW() and updated_at TIMESTAMPTZ DEFAULT NOW()

-- Tables missing BOTH created_at and updated_at
ALTER TABLE payment_modes ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE payment_modes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE site_order_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE site_order_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE retailer_bill_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE retailer_bill_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE purchase_order_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE purchase_order_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE stock_transfer_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stock_transfer_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Tables missing only updated_at
ALTER TABLE menu_allotments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE site_tagging ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE attendance ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE site_leaves ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE employee_ledger ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE site_orders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE supervisors ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE supervisor_site_tagging ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE retailer_bills ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE balance_received ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE payments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE income_expenses ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE company_loans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE company_emis ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE vehicle_service_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE approval_requests ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE activity_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
