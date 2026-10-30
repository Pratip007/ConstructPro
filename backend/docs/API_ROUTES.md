# ATR ConstructPro — API Routes Reference

## Global Conventions

| Convention | Detail |
|---|---|
| Base URL | `http://localhost:3000/api` |
| Auth header | `Authorization: Bearer <access_token>` |
| Response shape | `{ success: boolean, data?: any, error?: string }` |
| Monetary values | `NUMERIC(15,2)` — 2 decimal places |
| Display IDs | `"PREFIX-NNN"` format (e.g. `EMP-001`) |
| Roles | `admin`, `office`, `supervisor`, `employee` |
| Soft delete | Sets `status = 'inactive'` or `'cancelled'` — never hard deletes |

---

## 1. Health Check

### `GET /api/health`
- **Auth**: No
- **Response**: `{ status: "ok", timestamp: "<ISO>" }`

---

## 2. Auth

### `POST /api/auth/signup`
- **Auth**: Yes — admin only
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "min8chars",
    "name": "Full Name",
    "role": "admin|office|supervisor|employee",
    "displayId": "EMP-001",
    "siteId": "<uuid>",
    "aadhaar": "123456789012"
  }
  ```
- **Response 201**: `{ user: { id, display_id, name, role, site_id, created_at } }`
- **Errors**: 400 invalid input, 400 duplicate email/display_id

---

### `POST /api/auth/login`
- **Auth**: No
- **Body**: `{ "email": "...", "password": "..." }`
- **Response 200**: `{ access_token, refresh_token, user: { id, display_id, name, role, site_id } }`
- **Errors**: 400 invalid credentials or profile not found

---

### `GET /api/auth/me`
- **Auth**: Yes — all roles
- **Response 200**: `{ id, auth_uid, display_id, name, role, site_id, created_at, updated_at }`
- **Errors**: 404 profile not found

---

### `PUT /api/auth/password`
- **Auth**: Yes — all roles (changes own password)
- **Body**: `{ "newPassword": "min8chars" }`
- **Response 200**: `{ message: "Password updated successfully" }`
- **Errors**: 400 validation failure

---

## 3. Employees

### `GET /api/employees`
- **Auth**: Yes — all roles (supervisor auto-filtered to own site)
- **Query**: `site_id`, `status`, `category_id`
- **Response 200**: Array of employee objects with joined `employee_categories`

---

### `POST /api/employees`
- **Auth**: Yes — admin, office, supervisor
- **Body**:
  ```json
  {
    "name": "Worker Name",
    "salary_basis": "Per Day|Monthly",
    "base_daily_wage": 500,
    "aadhaar": "123456789012",
    "phone": "...",
    "designation": "...",
    "category_id": "<uuid>",
    "current_site_id": "<uuid>",
    "joining_date": "2026-01-01"
  }
  ```
- **Admin response 201**: Employee object (direct insert + auth user created)
- **Office/Supervisor response 202**: `{ approval: { id, status, created_at }, message }`
- **Errors**: 400 missing required fields

---

### `PUT /api/employees/:id`
- **Auth**: Yes — admin, office, supervisor
- **Body**: Any subset of `name, phone, designation, salary_basis, base_daily_wage, category_id, current_site_id, joining_date, status`
- **Admin response 200**: Updated employee object
- **Office/Supervisor response 202**: Approval request object
- **Errors**: 400 no fields, 404 not found

---

### `DELETE /api/employees/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, employee: { id, display_id, status: "inactive" } }`
- **Errors**: 404 not found

---

### Employee Categories

### `GET /api/employee-categories`
- **Auth**: Yes — all roles
- **Response 200**: Array of `{ id, display_id, name, working_days, created_at, updated_at }`

---

### `POST /api/employee-categories`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "Mason", "working_days": 26 }`
- **Response 201**: Category object

---

### `PUT /api/employee-categories/:id`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "...", "working_days": 25 }`
- **Response 200**: Updated category object
- **Errors**: 400 no fields, 404 not found

---

### `DELETE /api/employee-categories/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message: "Category deleted" }`

---

### Employee Sub-IDs

### `GET /api/employees/:id/sub-ids`
- **Auth**: Yes — all roles
- **Response 200**: Array of sub-ID objects for the employee

---

### `POST /api/employees/:id/sub-ids`
- **Auth**: Yes — admin, office
- **Body**: `{ "site_id": "<uuid>", "rate": 600, "salary_basis": "Per Day|Monthly" }`
- **Response 201**: Sub-ID object with generated `display_id` (`SUB-NNN`)

---

## 4. Site Tagging

### `GET /api/site-tagging`
- **Auth**: Yes — all roles
- **Query**: `employee_id`
- **Response 200**: Array of `{ id, employee_id, site_id, tagged_at, tagged_by, created_at }`

---

### `POST /api/site-tagging`
- **Auth**: Yes — admin, office
- **Body**: `{ "employeeId": "<uuid>", "siteId": "<uuid>" }`
- **Response 201**: Site-tagging log entry (also updates `employees.current_site_id`)

---

## 5. Attendance

### `GET /api/attendance`
- **Auth**: Yes — all roles (supervisor auto-filtered to own site)
- **Query**: `employee_id`, `site_id`, `month` (YYYY-MM)
- **Response 200**: Array of attendance records with computed wage fields

---

### `POST /api/attendance`
- **Auth**: Yes — admin, supervisor
- **Body**:
  ```json
  {
    "employeeId": "<uuid>",
    "subId": "<uuid>",
    "siteId": "<uuid>",
    "month": "2026-09",
    "presentDays": 24,
    "otHours": 8
  }
  ```
- **Admin response 201**: Attendance record (direct insert + employee_ledger Credit created)
- **Supervisor response 202**: Approval request object

---

## 6. Employee Ledger

### `GET /api/employee-ledger/:employeeId`
- **Auth**: Yes — all roles (employee role can only access own ledger)
- **Response 200**: Array of ledger entries with computed `running_balance`
- **Errors**: 403 unauthorized (employee accessing other's ledger), 500 DB error

---

## 7. Site Leaves

### `GET /api/site-leaves`
- **Auth**: Yes — all roles (supervisor auto-filtered to own site)
- **Query**: `employee_id`, `site_id`, `date`
- **Response 200**: Array of `{ id, employee_id, site_id, leave_date, reason, created_at }`

---

### `POST /api/site-leaves`
- **Auth**: Yes — admin, office, supervisor
- **Body**: `{ "date": "2026-09-15", "employeeId": "<uuid>", "siteId": "<uuid>", "reason": "..." }`
- **Response 201**: Leave entry object

---

## 8. Payments + Payment Modes

### `POST /api/payments`
- **Auth**: Yes — all roles (supervisor restricted to `employee` and `retailer` categories)
- **Body**:
  ```json
  {
    "date": "2026-09-01",
    "category": "employee|retailer|contractor|mobilization|office|other",
    "amount": 10000,
    "tdsPercentage": 2,
    "partyId": "<uuid>",
    "partyName": "Party Name",
    "partyType": "...",
    "siteId": "<uuid>",
    "paymentModeId": "<uuid>",
    "bankId": "<uuid>",
    "remarks": "..."
  }
  ```
- **Response 201**: Payment object
- **Notes**: Admin → `status=cleared`; Supervisor → `status=on_hold`; Office → `status=pending_approval`; TDS computed for `contractor` and `mobilization` categories; Employee cleared payments auto-create `employee_ledger` Debit entry

---

### `GET /api/payments`
- **Auth**: Yes — all roles (supervisor auto-filtered to own site)
- **Query**: `category`, `site_id`, `status`, `from` (date), `to` (date)
- **Response 200**: Array of payment objects

---

### `PUT /api/payments/:id`
- **Auth**: Yes — admin only
- **Body**: Any subset of `date, category, partyId, partyName, partyType, siteId, paymentModeId, bankId, remarks, status, amount, tdsPercentage`
- **Response 200**: Updated payment object
- **Notes**: TDS amounts are recalculated if `amount` or `tdsPercentage` changes

---

### `DELETE /api/payments/:id`
- **Auth**: Yes — admin only
- **Response 200**: Payment object with `status: "voided"`

---

### `GET /api/payment-modes`
- **Auth**: Yes — all roles
- **Response 200**: Array of `{ id, name, description, is_active }`

---

### `POST /api/payment-modes`
- **Auth**: Yes — admin only
- **Body**: `{ "name": "NEFT", "description": "..." }`
- **Response 201**: Payment mode object

---

## 9. Approvals

### `POST /api/approvals`
- **Auth**: Yes — office, supervisor only
- **Body**:
  ```json
  {
    "source": "office|supervisor",
    "module": "Company",
    "action_type": "new_entry|edit|delete|status_toggle",
    "reference_id": "<optional>",
    "amount": 5000,
    "old_data": {},
    "new_data": {},
    "reason": "...",
    "site_id": "<optional>"
  }
  ```
- **Response 201**: Approval request object

---

### `GET /api/approvals`
- **Auth**: Yes — all roles (admin sees all; others see own requests)
- **Query**: `status` (pending|approved|rejected), `source` (office|supervisor), `module`
- **Response 200**: Array of approval request objects

---

### `GET /api/approvals/pending-counts`
- **Auth**: Yes — admin only
- **Response 200**: `{ office: N, supervisor: N, loans: 0 }`

---

### `PUT /api/approvals/:id/approve`
- **Auth**: Yes — admin only
- **Body**: `{ "remarks": "..." }` (optional)
- **Response 200**: Updated approval request

---

### `PUT /api/approvals/:id/reject`
- **Auth**: Yes — admin only
- **Body**: `{ "remarks": "Reason for rejection" }` (required)
- **Response 200**: Updated approval request

---

## 10. Companies

### `GET /api/companies`
- **Auth**: Yes — all roles
- **Query**: `status`
- **Response 200**: Array of company objects

---

### `POST /api/companies`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "...", "gst_number": "...", "state_code": "WB", "phone": "...", "email": "...", "address": "...", "custom_fields": {} }`
- **Admin response 201**: Company object (display_id auto-generated: `COMP-NNN`)
- **Office response 202**: Approval request object

---

### `PUT /api/companies/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of allowed fields
- **Admin response 200**: Updated company object
- **Office response 202**: Approval request object
- **Errors**: 400 no fields, 404 not found

---

### `DELETE /api/companies/:id`
- **Auth**: Yes — admin, office
- **Admin response 200**: `{ message, company: { id, display_id, status: "inactive" } }`
- **Office response 202**: Approval request object

---

## 11. Sites

### `GET /api/sites`
- **Auth**: Yes — all roles
- **Query**: `company_id`, `status`
- **Response 200**: Array of site objects

---

### `POST /api/sites`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "...", "company_id": "<uuid>", "address": "...", "status": "active|completed|upcoming" }`
- **Admin response 201**: Site object (display_id: `SITE-NNN`)
- **Office response 202**: Approval request object

---

### `PUT /api/sites/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of `name, company_id, address, status`
- **Admin response 200**: Updated site object
- **Office response 202**: Approval request object

---

### `DELETE /api/sites/:id`
- **Auth**: Yes — admin, office
- **Admin response 200**: `{ message, site: { id, display_id, status: "inactive" } }`
- **Office response 202**: Approval request object

---

## 12. Banks

### `GET /api/banks`
- **Auth**: Yes — all roles
- **Response 200**: Array of active bank objects

---

### `POST /api/banks`
- **Auth**: Yes — admin only
- **Body**: `{ "bank_name": "...", "branch_name": "...", "account_number": "...", "ifsc_code": "...", "account_type": "...", "holder_name": "...", "opening_balance": 100000 }`
- **Response 201**: Bank object

---

### `PUT /api/banks/:id`
- **Auth**: Yes — admin only
- **Body**: Any subset of `bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance, status`
- **Response 200**: Updated bank object

---

### `DELETE /api/banks/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, bank: { id, bank_name, status: "inactive" } }`

---

## 13. Contractors

### `GET /api/contractors`
- **Auth**: Yes — all roles
- **Query**: `status`, `category`
- **Response 200**: Array of contractor objects

---

### `POST /api/contractors`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "...", "phone": "...", "email": "...", "pan": "...", "gst_number": "...", "category": "...", "address": "...", "tds_applicable": true, "tds_percent": 2.0 }`
- **Admin response 201**: Contractor object (display_id: `CON-NNN`)
- **Office response 202**: Approval request object

---

### `PUT /api/contractors/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of allowed contractor fields
- **Admin response 200**: Updated contractor object
- **Office response 202**: Approval request object

---

### `DELETE /api/contractors/:id`
- **Auth**: Yes — admin (password confirmation required), office (approval)
- **Admin body**: `{ "password": "admin_password" }` (required for verification)
- **Admin response 200**: `{ message, contractor: { id, display_id, status: "inactive" } }`
- **Office response 202**: Approval request object
- **Errors**: 403 password verification failed

---

## 14. Supervisors + Supervisor Site Tagging

### `GET /api/supervisors`
- **Auth**: Yes — all roles
- **Query**: `status`
- **Response 200**: Array of supervisor objects

---

### `POST /api/supervisors`
- **Auth**: Yes — admin only
- **Body**: `{ "name": "...", "contact": "...", "address": "...", "siteId": "<uuid>", "employee_id": "<uuid>", "password": "min8chars" }`
- **Response 201**: `{ supervisor, profile, email }` (creates auth user + profile + supervisor row)

---

### `PUT /api/supervisors/:id`
- **Auth**: Yes — admin only
- **Body**: Any subset of `name, contact, address, employee_id, siteId, status`
- **Response 200**: Updated supervisor object (also syncs linked profile site_id)

---

### `DELETE /api/supervisors/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, supervisor: { id, display_id, status: "inactive" } }`

---

### `POST /api/supervisor-site-tagging`
- **Auth**: Yes — admin only
- **Body**: `{ "supervisorId": "<uuid>", "siteId": "<uuid>" }`
- **Response 201**: `{ tagging, message }` (creates log entry, updates supervisor assigned_site_id and profile site_id)

---

## 15. Retailers + Retailer Categories

### `GET /api/retailers`
- **Auth**: Yes — all roles (supervisor auto-filtered to own site)
- **Query**: `status`, `site_id`, `category_id`
- **Response 200**: Array of retailer objects

---

### `POST /api/retailers`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "...", "phone": "...", "address": "...", "gst_status": "YES|NO", "gst_number": "...", "site_id": "<uuid>", "category_id": "<uuid>" }`
- **Admin response 201**: Retailer object (display_id: `RET-NNN`)
- **Office response 202**: Approval request object

---

### `PUT /api/retailers/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of allowed retailer fields
- **Admin response 200**: Updated retailer object
- **Office response 202**: Approval request object

---

### `DELETE /api/retailers/:id`
- **Auth**: Yes — admin, office
- **Admin response 200**: `{ message, retailer: { id, display_id, status: "inactive" } }`
- **Office response 202**: Approval request object

---

### `GET /api/retailer-categories`
- **Auth**: Yes — all roles
- **Response 200**: Array of `{ id, name, description, status, created_at, updated_at }`

---

### `POST /api/retailer-categories`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "Building Materials", "description": "..." }`
- **Response 201**: Category object

---

### `PUT /api/retailer-categories/:id`
- **Auth**: Yes — admin only
- **Body**: Any subset of `name, description, status`
- **Response 200**: Updated category object

---

## 16. Purchase Orders

### `GET /api/purchase-orders`
- **Auth**: Yes — all roles
- **Query**: `site_id`, `status`
- **Response 200**: Array of PO header objects

---

### `GET /api/purchase-orders/:id`
- **Auth**: Yes — all roles
- **Response 200**: PO object with nested `items[]`
- **Errors**: 404 not found

---

### `POST /api/purchase-orders`
- **Auth**: Yes — admin, office
- **Body**:
  ```json
  {
    "date": "2026-09-01",
    "site_id": "<uuid>",
    "retailer_id": "<uuid>",
    "status": "active",
    "items": [
      { "name": "Cement", "qty": 100, "price": 400, "unit": "Bag", "hsn": "2523", "gst_percent": 18, "product_id": "<uuid>" }
    ]
  }
  ```
- **Response 201**: PO object with `items[]`, `base_amount`, `gst_amount`, `net_amount` computed (display_id: `PO-NNN`)

---

### `PUT /api/purchase-orders/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of `date, site_id, retailer_id, status` + optional `items[]` to replace line items
- **Response 200**: Updated PO object (totals recomputed if items provided)

---

### `DELETE /api/purchase-orders/:id`
- **Auth**: Yes — admin, office
- **Response 200**: `{ message, purchaseOrder: { id, display_id, status: "inactive" } }`

---

## 17. Invoices

### `GET /api/invoices`
- **Auth**: Yes — all roles
- **Query**: `company_id`, `status`, `is_gst` (true|false)
- **Response 200**: Array of invoice objects

---

### `GET /api/invoices/:id`
- **Auth**: Yes — all roles
- **Response 200**: Invoice object
- **Errors**: 404 not found

---

### `POST /api/invoices`
- **Auth**: Yes — admin, office
- **Body**: `{ "date": "2026-09-01", "base_amount": 100000, "gst_amount": 18000, "is_gst": true, "po_id": "<uuid>", "company_id": "<uuid>", "site_name": "...", "file_path": "..." }`
- **Response 201**: Invoice object (display_id: `INV-NNN`, `gross_amount = base_amount + gst_amount`, initial `status: "unpaid"`)

---

### `PUT /api/invoices/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of `po_id, company_id, site_name, date, base_amount, gst_amount, is_gst, status, file_path`
- **Response 200**: Updated invoice (`gross_amount` recomputed when monetary fields change)

---

### `DELETE /api/invoices/:id`
- **Auth**: Yes — admin, office
- **Response 200**: `{ message, invoice: { id, display_id, status: "cancelled" } }`

---

## 18. Balance Received

### `GET /api/balance-received`
- **Auth**: Yes — all roles
- **Query**: `invoice_id`
- **Response 200**: Array of balance-received records

---

### `POST /api/balance-received`
- **Auth**: Yes — admin, office
- **Body**: `{ "invoiceId": "<uuid>", "date": "2026-09-10", "amount": 50000, "tdsAmount": 2000, "entryType": "PAYMENT|TDS", "paymentMethod": "...", "referenceNumber": "...", "remarks": "..." }`
- **Response 201**: `{ record, invoiceStatus: "paid|partial|unpaid", totalReceived }` (invoice status auto-updated)

---

## 19. Retailer Bills

### `GET /api/retailer-bills`
- **Auth**: Yes — all roles
- **Query**: `site_id`, `retailer_id`, `status`, `gst_applicable` (true|false)
- **Response 200**: Array of bill header objects

---

### `GET /api/retailer-bills/gst-report`
- **Auth**: Yes — all roles
- **Response 200**: All bills where `gst_applicable = true`

---

### `GET /api/retailer-bills/non-gst-report`
- **Auth**: Yes — all roles
- **Response 200**: All bills where `gst_applicable = false`

---

### `GET /api/retailer-bills/:id`
- **Auth**: Yes — all roles
- **Response 200**: Bill object with nested `items[]`

---

### `POST /api/retailer-bills`
- **Auth**: Yes — admin, office
- **Body**:
  ```json
  {
    "date": "2026-09-01",
    "inv_type": "GST",
    "inv_no": "INV-2026-01",
    "category": "...",
    "retailer_name": "Bengal Cement House",
    "retailer_id": "<uuid>",
    "site_id": "<uuid>",
    "gst_applicable": true,
    "gst_number": "...",
    "paid_amount": 5000,
    "file_path": "...",
    "cart_items": [
      { "item": "Cement", "qty": 100, "price": 400, "unit": "Bag", "gst_percent": 18, "add_to_stock": true }
    ]
  }
  ```
- **Response 201**: Bill object with `items[]`, `total_amount`, `due_amount`, `status` (DUE|PAID) computed (display_id: `BILL-NNN`)

---

### `PUT /api/retailer-bills/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of allowed bill fields
- **Response 200**: Updated bill (`due_amount` and `status` recomputed if `paid_amount` changes)

---

### `DELETE /api/retailer-bills/:id`
- **Auth**: Yes — admin, office
- **Response 200**: `{ message, bill: { id, display_id, status: "CANCELLED" } }`

---

## 20. Loans (Company Loans + EMIs)

### `GET /api/loans`
- **Auth**: Yes — all roles
- **Query**: `status`
- **Response 200**: Array of loan objects

---

### `GET /api/loans/reminders`
- **Auth**: Yes — all roles
- **Response 200**: Active loans where today is within `due_date ± remind_days` and no EMI exists for the current month

---

### `GET /api/loans/:id`
- **Auth**: Yes — all roles
- **Response 200**: Loan object with nested `emis[]`

---

### `POST /api/loans`
- **Auth**: Yes — admin, office
- **Body**: `{ "principal": 1000000, "interest_type": "%|₹", "interest_value": 8.5, "tenure": 36, "due_date": 5, "remind_days": 3, "bank": "SBI", "purpose": "...", "loan_id_external": "...", "start_date": "2026-01-01", "status": "active" }`
- **Response 201**: Loan object with computed `total_payable` and `monthly_emi` (display_id: `LOAN-NNN`)

---

### `PUT /api/loans/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of `loan_id_external, bank, purpose, due_date, remind_days, start_date, status`
- **Response 200**: Updated loan object

---

### `GET /api/loans/:id/emis`
- **Auth**: Yes — all roles
- **Response 200**: Array of EMI payment records

---

### `POST /api/loans/:id/emis`
- **Auth**: Yes — admin, office
- **Body**: `{ "date": "2026-09-05", "amount": 30000, "ref_no": "...", "pay_bank": "..." }`
- **Response 201**: EMI record

---

## 21. Stock Products

### `GET /api/stock-products`
- **Auth**: Yes — all roles
- **Query**: `category`, `status`
- **Response 200**: Array of stock product objects

---

### `POST /api/stock-products`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "Cement", "unit": "Bag", "hsn": "2523", "category": "Building", "gst_percent": 18 }`
- **Response 201**: Stock product object (display_id: `SP-NNN`)

---

## 22. Site Inventory

### `GET /api/site-inventory`
- **Auth**: Yes — all roles (supervisor auto-filtered to own site)
- **Query**: `site_id`, `product_id`
- **Response 200**: Array of `{ id, product_id, site_id, quantity, last_updated, created_at, updated_at }`

---

## 23. Stock Transfers

### `GET /api/stock-transfers`
- **Auth**: Yes — all roles
- **Query**: `from_site_id`, `to_site_id`, `status`
- **Response 200**: Array of stock transfer header objects

---

### `POST /api/stock-transfers`
- **Auth**: Yes — admin, office
- **Body**:
  ```json
  {
    "date": "2026-09-01",
    "fromSiteId": "<uuid>",
    "toSiteId": "<uuid>",
    "remarks": "...",
    "items": [
      { "productId": "<uuid>", "qty": 50, "unit": "Bag", "remarks": "..." }
    ]
  }
  ```
- **Response 201**: Transfer object with `items[]` (inventory adjusted; display_id: `STR-NNN`)
- **Errors**: 400 same source/destination, 400 insufficient stock

---

## 24. Damaged Stocks

### `GET /api/damaged-stocks`
- **Auth**: Yes — all roles
- **Query**: `site_id`, `product_id`
- **Response 200**: Array of damaged stock records

---

### `POST /api/damaged-stocks`
- **Auth**: Yes — admin, office
- **Body**: `{ "date": "2026-09-01", "productId": "<uuid>", "siteId": "<uuid>", "quantity": 5, "unit": "Bag", "reason": "..." }`
- **Response 201**: Damaged stock record (site inventory reduced; display_id: `DMG-NNN`)
- **Errors**: 400 no inventory found, 400 insufficient stock

---

## 25. Equipment Categories + Equipment + Equipment Site Assignments

### `GET /api/equipment-categories`
- **Auth**: Yes — all roles
- **Response 200**: Array of `{ id, name, description, status, created_at, updated_at }`

---

### `POST /api/equipment-categories`
- **Auth**: Yes — admin only
- **Body**: `{ "name": "Crane", "description": "..." }`
- **Response 201**: Category object

---

### `PUT /api/equipment-categories/:id`
- **Auth**: Yes — admin only
- **Body**: Any subset of `name, description, status`
- **Response 200**: Updated category object

---

### `DELETE /api/equipment-categories/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, category: { id, name, status: "inactive" } }`

---

### `GET /api/equipment`
- **Auth**: Yes — all roles
- **Query**: `status`, `category_id`
- **Response 200**: Array of equipment party objects

---

### `POST /api/equipment`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "...", "contact": "...", "address": "...", "category_id": "<uuid>" }`
- **Response 201**: Equipment party object (display_id: `EQP-NNN`)

---

### `PUT /api/equipment/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of `name, contact, address, category_id, status`
- **Response 200**: Updated equipment object

---

### `DELETE /api/equipment/:id`
- **Auth**: Yes — admin, office
- **Response 200**: `{ message, equipment: { id, display_id, status: "inactive" } }`

---

### `GET /api/equipment-site-assignments`
- **Auth**: Yes — all roles
- **Query**: `equipment_party_id`, `site_id`, `status`
- **Response 200**: Array of assignment objects

---

### `POST /api/equipment-site-assignments`
- **Auth**: Yes — admin, office
- **Body**: `{ "equipment_party_id": "<uuid>", "site_id": "<uuid>", "assigned_date": "2026-09-01", "released_date": "2026-09-30", "rate": 5000, "rate_unit": "Per Day", "remarks": "..." }`
- **Response 201**: Assignment object (display_id: `ESA-NNN`)

---

## 26. Vehicles

### `GET /api/vehicles`
- **Auth**: Yes — all roles
- **Query**: `status`, `assigned_site_id`
- **Response 200**: Array of vehicle objects

---

### `POST /api/vehicles`
- **Auth**: Yes — admin only
- **Body**: `{ "vehicle_number": "WB-26-1234", "vehicle_type": "Truck", "make": "Tata", "model": "407", "year": 2022, "owner_name": "...", "owner_contact": "...", "assigned_site_id": "<uuid>" }`
- **Response 201**: Vehicle object (display_id: `VEH-NNN`)

---

### `PUT /api/vehicles/:id`
- **Auth**: Yes — admin, office
- **Body**: Any subset of `vehicle_number, vehicle_type, make, model, year, owner_name, owner_contact, assigned_site_id, status`
- **Response 200**: Updated vehicle object

---

### `DELETE /api/vehicles/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, vehicle: { id, display_id, status: "inactive" } }`

---

### `GET /api/vehicles/:id/service-logs`
- **Auth**: Yes — all roles
- **Response 200**: Array of service log entries ordered by `service_date DESC`

---

### `POST /api/vehicles/:id/service-logs`
- **Auth**: Yes — admin, office
- **Body**: `{ "service_date": "2026-09-01", "service_type": "Oil Change", "description": "...", "cost": 2500, "odometer_reading": 45000, "next_service_date": "2026-12-01", "serviced_by": "...", "remarks": "..." }`
- **Response 201**: Service log entry

---

## 27. Income/Expenses

### `GET /api/income-expenses`
- **Auth**: Yes — all roles
- **Query**: `type` (Income|Expense), `purpose`, `from` (date), `to` (date)
- **Response 200**: `{ entries: [...], summary: { totalIncome, totalExpense, netBalance } }` (excludes `status=inactive`)

---

### `POST /api/income-expenses`
- **Auth**: Yes — admin, office
- **Body**: `{ "date": "2026-09-01", "type": "Income|Expense", "amount": 5000, "bank_account": "...", "purpose": "...", "particulars": "...", "remark": "..." }`
- **Response 201**: Income/expense entry object

---

### `PUT /api/income-expenses/:id`
- **Auth**: Yes — admin only
- **Body**: Any subset of `date, type, bank_account, purpose, particulars, remark, amount, status`
- **Response 200**: Updated entry object

---

### `DELETE /api/income-expenses/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, entry: { id, status: "inactive" } }`

---

## 28. Settings (Terms, Heads, Menus)

### `GET /api/settings/terms`
- **Auth**: Yes — all roles
- **Query**: `module`, `status`
- **Response 200**: Array of terms & conditions objects

---

### `POST /api/settings/terms`
- **Auth**: Yes — admin, office
- **Body**: `{ "title": "...", "content": "...", "module": "invoice|purchase_order" }`
- **Admin response 201**: Terms & conditions object
- **Office response 202**: Approval request object

---

### `PUT /api/settings/terms/:id`
- **Auth**: Yes — admin only
- **Body**: Any subset of `title, content, module, status`
- **Response 200**: Updated terms object

---

### `DELETE /api/settings/terms/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, terms: { id, title, status: "inactive" } }`

---

### `GET /api/settings/heads`
- **Auth**: Yes — all roles
- **Query**: `type` (Income|Expense), `status`
- **Response 200**: Array of head allotment objects

---

### `POST /api/settings/heads`
- **Auth**: Yes — admin only
- **Body**: `{ "name": "Site Expense", "type": "Income|Expense", "description": "..." }`
- **Response 201**: Head allotment object

---

### `PUT /api/settings/heads/:id`
- **Auth**: Yes — admin only
- **Body**: Any subset of `name, type, description, status`
- **Response 200**: Updated head allotment object

---

### `DELETE /api/settings/heads/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, head: { id, name, status: "inactive" } }`

---

### `GET /api/settings/menus/:profileId`
- **Auth**: Yes — all roles
- **Response 200**: Array of `{ id, profile_id, menu_item_id, menu_name, menu_url, granted, created_at }`

---

### `PUT /api/settings/menus/:profileId`
- **Auth**: Yes — admin only
- **Body**: `{ "menuItems": [{ "menuItemId": "...", "menuName": "...", "menuUrl": "...", "granted": true }] }`
- **Response 200**: `{ message, items: [...] }` (replaces all menu allotments for the profile)

---

## 29. Document Folders + Documents

### `GET /api/document-folders`
- **Auth**: Yes — all roles
- **Query**: `site_id`, `parent_id`
- **Response 200**: Array of folder objects

---

### `POST /api/document-folders`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "...", "siteId": "<uuid>", "parentId": "<uuid>" }`
- **Response 201**: Folder object (display_id: `FOLD-NNN`)

---

### `DELETE /api/document-folders/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, folder: { id, display_id, name, status: "inactive" } }`

---

### `GET /api/documents`
- **Auth**: Yes — all roles
- **Query**: `folder_id`, `site_id`
- **Response 200**: Array of document metadata objects

---

### `POST /api/documents`
- **Auth**: Yes — admin, office
- **Body**: `{ "name": "...", "fileData": "<base64>", "fileType": "application/pdf", "folderId": "<uuid>", "siteId": "<uuid>", "description": "..." }`
- **Response 201**: Document metadata object (file uploaded to Supabase Storage; display_id: `DOC-NNN`)
- **Errors**: 400 invalid base64, 500 storage upload failed

---

### `GET /api/documents/:id/download`
- **Auth**: Yes — all roles
- **Response 200**: `{ url: "<signed_url>", document: { id, display_id, name, file_path } }` (URL valid for 1 hour)
- **Errors**: 404 not found or inactive

---

### `DELETE /api/documents/:id`
- **Auth**: Yes — admin only
- **Response 200**: `{ message, document: { id, display_id, status: "inactive" } }` (also removes file from Storage)

---

## 30. Backup

### `POST /api/backup/export`
- **Auth**: Yes — admin only
- **Response 200**: JSON object with all major table data + `_meta` block
- **Exported tables** (in FK-safe order): `companies, banks, equipment_categories, head_allotments, terms_conditions, sites, contractors, retailers, supervisors, employees, stock_products, vehicles`

---

### `POST /api/backup/import`
- **Auth**: Yes — admin only
- **Body**: `{ "companies": [...], "sites": [...], ... }` (all keys optional; only present tables restored)
- **Response 200**: `{ message, report: { tableName: { restored: N } | { skipped: true } }, imported_at }`
- **Notes**: Deletes existing data in reverse FK order then reinserts in FK order
- **Errors**: 400 unknown table keys, 400 non-array values, 500 DB error

---

## 31. Dashboard

### `GET /api/dashboard/kpis`
- **Auth**: Yes — admin only
- **Response 200**: Active entity counts + bank balances
  ```json
  {
    "activeSites": 3,
    "activeEmployees": 12,
    "activeContractors": 3,
    "totalBankBalance": 1500000,
    ...
  }
  ```

---

### `GET /api/dashboard/pending-dues`
- **Auth**: Yes — admin only
- **Response 200**: Outstanding balances for employees, retailers, contractors

---

### `GET /api/dashboard/notifications`
- **Auth**: Yes — admin only
- **Response 200**: `{ office: N, supervisor: N }` — count of pending approval requests by source

---

## 32. Reports

### `GET /api/reports/site-ledger`
- **Auth**: Yes — admin, office
- **Query**: `site_id` (required), `company_id` (optional)
- **Response 200**: 4-section monthly site aggregation (attendance, payments, stock, invoices)

---

### `GET /api/reports/mobilization`
- **Auth**: Yes — admin, office
- **Query**: `site_id`, `party_id`, `from` (date), `to` (date)
- **Response 200**: Equipment site assignments enriched with `duration_days` and `total_cost`

---

### `GET /api/reports/sales`
- **Auth**: Yes — admin, office
- **Query**: `company_id`, `fy` (4-digit year, e.g. 2026 → April 2026–March 2027)
- **Response 200**: `{ monthly: [...], grandTotal: { gross, base, gst } }` — invoices grouped by month

---

## 33. Ledger

### `GET /api/ledger/employee/:id`
- **Auth**: Yes — all roles (employee role restricted to own ID)
- **Query**: `from` (date), `to` (date)
- **Response 200**: Employee ledger with running balance
- **Errors**: 403 employee accessing other's ledger

---

### `GET /api/ledger/contractor/:id`
- **Auth**: Yes — admin, office
- **Query**: `from`, `to`
- **Response 200**: Contractor payment ledger

---

### `GET /api/ledger/retailer/:id`
- **Auth**: Yes — admin, office
- **Query**: `from`, `to`
- **Response 200**: Retailer bill + payment ledger

---

### `GET /api/ledger/supervisor/:id`
- **Auth**: Yes — admin, office
- **Query**: `from`, `to`
- **Response 200**: Supervisor payment ledger

---

### `GET /api/ledger/company/:id`
- **Auth**: Yes — admin, office
- **Query**: `from`, `to`
- **Response 200**: Company invoice + balance-received ledger
