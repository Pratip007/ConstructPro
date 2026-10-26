# ATR ConstructPro ERP Backend — Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Node.js + Express + Supabase backend that replaces the current localStorage-based frontend-only ERP, preserving all existing business logic (OT calculations, TDS deductions, approval workflows, ledger auto-sync, role-based access).

**Architecture:** Express API server with Supabase as the backend-as-a-service layer. Supabase Auth handles user registration, login, and JWT tokens. Supabase Storage handles file uploads (invoices, KYC docs, employee photos). PostgreSQL (via Supabase) stores all data in ~35 tables with Row Level Security (RLS) policies. Express routes contain business logic (OT, TDS, settlement, approval workflow, ledger sync) and call Supabase via the JS client. The frontend HTML files will be migrated incrementally to call API endpoints instead of localStorage.

**Tech Stack:** Node.js 20+, Express 4, `@supabase/supabase-js` 2.x, express-validator, dotenv, cors, helmet

**Spec:** `docs/superpowers/plans/2026-10-27-backend-erp.md` — original spec with all business logic extracted from 70+ frontend HTML files.

## Business Logic Reference (preserved exactly from frontend)

### OT Calculation
```
presentWage = Math.round(baseDailyWage * daysCount)
if salaryBasis === "Per Day":
    otRatePerHr = baseDailyWage / 8
    otAmount = Math.round(otRatePerHr * otHours)
if salaryBasis === "Monthly":
    otAmount = 0
totalAmount = presentWage + otAmount
```

### TDS Calculation
```
tdsAmount = parseFloat((grossAmount * tdsPercentage / 100).toFixed(2))
netAmount = parseFloat((grossAmount - tdsAmount).toFixed(2))
```

### Settlement Logic
```
remaining = totalDue - payingAmount
isFullySettled = remaining <= 0
```

### Approval Workflow
- Office/Supervisor submit → status = "pending"
- Admin approves → status = "approved", auto-syncs to relevant ledger
- Admin rejects → status = "rejected", remarks required
- Attendance approval → employee ledger Credit entry
- Payment approval → employee ledger Debit entry

### Role Access Rules
- **Admin:** Full CRUD, direct save
- **Office:** CRUD requires approval routing, can view reports
- **Supervisor:** Site-locked, only employee & retailer payments, saves as "on_hold"
- **Employee:** Read-only ledger, authenticated via Aadhaar

## Global Constraints

- Node.js >= 20
- All monetary values: `NUMERIC(15,2)` in PostgreSQL — never float
- Dates: `DATE` or `TIMESTAMPTZ` in PostgreSQL, ISO 8601 in API
- Display IDs (e.g. "EMP-101") are generated strings in a `display_id` column; internal PK is `id BIGINT GENERATED ALWAYS AS IDENTITY`
- Supabase Auth manages passwords (bcrypt internally); Aadhaar stored as bcrypt hash in `profiles.aadhaar_hash`
- JWT handled by Supabase Auth; custom claims hold `role` and `site_id`
- API responses: `{ success: boolean, data?: any, error?: string }`
- Every table has `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ DEFAULT NOW()`
- No hardcoded passwords — admin seeded via env var `DEFAULT_ADMIN_PASSWORD`

## Review Focus

1. **OT with zero otHours:** Per Day with 0 hours → otAmount must be 0, not NaN. Monthly → always 0 regardless of otHours value. Test in Task 4.
2. **TDS with 0% rate:** netAmount must equal grossAmount exactly, no float drift. Test in Task 5.
3. **Concurrent approval:** Two admins approving same request → second gets 409, no double ledger sync. Test in Task 6.
4. **Supervisor site-lock bypass:** Direct API call with wrong siteId → 403. JWT `site_id` claim is the authority. Test in Task 3.
5. **Aadhaar never exposed:** No API response ever returns aadhaar_hash or raw Aadhaar. Test in Task 3.

---

## File Structure

```
backend/
├── package.json
├── .env.example
├── server.js                            # Express bootstrap + Supabase init
├── src/
│   ├── config/
│   │   └── supabase.js                  # Supabase client (service role + anon)
│   ├── middleware/
│   │   ├── auth.js                      # Verify Supabase JWT → req.user
│   │   ├── roles.js                     # requireRole(...roles)
│   │   ├── sitelock.js                  # Supervisor site enforcement
│   │   └── validate.js                  # express-validator wrapper
│   ├── services/
│   │   ├── otCalculation.js             # OT wage computation (8-hr rule)
│   │   ├── tdsCalculation.js            # TDS deduction
│   │   ├── settlementCalc.js            # Payment settlement
│   │   ├── approvalEngine.js            # Approval + ledger auto-sync
│   │   └── reportAggregator.js          # Ledger + dashboard queries
│   ├── routes/
│   │   ├── auth.js                      # Login, signup, me, password change
│   │   ├── employees.js                 # Employee CRUD + sub-IDs + site tagging
│   │   ├── attendance.js                # Attendance + site leave
│   │   ├── payments.js                  # All-type payments + payment modes
│   │   ├── approvals.js                 # Approval request lifecycle
│   │   ├── companies.js                 # Company CRUD
│   │   ├── sites.js                     # Site CRUD
│   │   ├── banks.js                     # Company bank accounts
│   │   ├── contractors.js               # Contractor + site orders + products
│   │   ├── supervisors.js               # Supervisor CRUD + site tagging
│   │   ├── retailers.js                 # Retailer + bills + categories
│   │   ├── equipment.js                 # Equipment + site assignments
│   │   ├── vehicles.js                  # Vehicle + service logs
│   │   ├── stock.js                     # Products, inventory, transfers
│   │   ├── invoices.js                  # Sales invoices + POs + balance received
│   │   ├── loans.js                     # Company loans + EMIs
│   │   ├── reports.js                   # Ledgers, dashboard KPIs, reports
│   │   ├── settings.js                  # T&C, heads, menus, categories
│   │   └── backup.js                    # Export/import all data
│   └── utils/
│       ├── displayId.js                 # Generate EMP-101, PO-2026-001, etc.
│       └── response.js                  # sendSuccess / sendError helpers
├── supabase/
│   └── migrations/
│       ├── 00001_profiles_and_auth.sql
│       ├── 00002_core_tables.sql
│       ├── 00003_employee_tables.sql
│       ├── 00004_party_tables.sql
│       ├── 00005_financial_tables.sql
│       ├── 00006_stock_tables.sql
│       ├── 00007_settings_tables.sql
│       └── 00008_rls_policies.sql
├── seeds/
│   └── demo_data.sql
└── tests/
    ├── setup.js                         # Supabase test client + cleanup
    ├── unit/
    │   ├── otCalculation.test.js
    │   ├── tdsCalculation.test.js
    │   └── settlementCalc.test.js
    └── integration/
        ├── health.test.js
        ├── auth.test.js
        ├── employees.test.js
        ├── attendance.test.js
        ├── payments.test.js
        └── approvals.test.js
```

---

### Task 1: Project Scaffold + Supabase Connection

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/server.js`
- Create: `backend/src/config/supabase.js`
- Create: `backend/src/utils/response.js`
- Create: `backend/src/utils/displayId.js`
- Create: `backend/tests/setup.js`
- Create: `backend/tests/integration/health.test.js`

**Interfaces:**
- Consumes: Nothing (first task)
- Produces:
  - `supabase` — Supabase client (service role) from `src/config/supabase.js`
  - `supabaseAnon` — Supabase client (anon key) for auth operations
  - `sendSuccess(res, data, statusCode=200)` → `{ success: true, data }`
  - `sendError(res, message, statusCode=400)` → `{ success: false, error: message }`
  - `generateDisplayId(prefix, sequenceNum)` → `"EMP-101"`, `"PO-2026-001"`
  - `app` — Express instance exported for tests

- [ ] **Step 1: Initialize project**

```bash
mkdir backend && cd backend
npm init -y
npm install express @supabase/supabase-js dotenv cors helmet express-validator
npm install -D jest supertest
```

Set `jest` as test runner in package.json scripts.

- [ ] **Step 2: Create `.env.example`**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
PORT=3000
NODE_ENV=development
DEFAULT_ADMIN_PASSWORD=admin123
```

- [ ] **Step 3: Write `src/config/supabase.js`**

Export two clients: `supabase` (service role — bypasses RLS, for server-side operations) and `supabaseAnon` (anon key — for auth operations that respect RLS).

```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
module.exports = { supabase, supabaseAnon };
```

- [ ] **Step 4: Write `src/utils/response.js`**

`sendSuccess(res, data, statusCode)` and `sendError(res, message, statusCode)`.

- [ ] **Step 5: Write `src/utils/displayId.js`**

`generateDisplayId(prefix, sequenceNum)` → pads sequenceNum to 3 digits minimum, returns `"${prefix}-${padded}"`. Also `generateDisplayIdWithYear(prefix, year, seq)` → `"INV-2026-001"`.

- [ ] **Step 6: Write `server.js`**

Express app with cors, helmet, `express.json({ limit: '50mb' })`. Health check at `GET /api/health` returning `{ success: true, data: { status: 'ok', timestamp } }`. Export `app` for tests. Start listener only when not in test mode.

- [ ] **Step 7: Write `tests/setup.js`**

Creates a test Supabase client. Exports `getTestSupabase()` and cleanup helper `clearTable(tableName)`.

- [ ] **Step 8: Write health check test**

```javascript
test('GET /api/health returns 200 with ok status', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.data.status).toBe('ok');
});
```

- [ ] **Step 9: Run test, verify pass**

Run: `npm test -- tests/integration/health.test.js`

- [ ] **Step 10: Commit**

---

### Task 2: Database Schema (Supabase Migrations)

**Files:**
- Create: `backend/supabase/migrations/00001_profiles_and_auth.sql`
- Create: `backend/supabase/migrations/00002_core_tables.sql`
- Create: `backend/supabase/migrations/00003_employee_tables.sql`
- Create: `backend/supabase/migrations/00004_party_tables.sql`
- Create: `backend/supabase/migrations/00005_financial_tables.sql`
- Create: `backend/supabase/migrations/00006_stock_tables.sql`
- Create: `backend/supabase/migrations/00007_settings_tables.sql`

**Interfaces:**
- Consumes: Supabase project (created via dashboard)
- Produces: All ~35 tables in PostgreSQL. Every subsequent task queries these tables.

- [ ] **Step 1: Write `00001_profiles_and_auth.sql`**

```sql
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
```

- [ ] **Step 2: Write `00002_core_tables.sql`**

```sql
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
```

- [ ] **Step 3: Write `00003_employee_tables.sql`**

Tables: `employee_categories`, `employees`, `employee_sub_ids`, `site_tagging`, `attendance`, `site_leaves`, `employee_ledger`.

`employees` columns: `id`, `display_id`, `name`, `father_name`, `dob DATE`, `religion`, `village`, `post`, `ps`, `district`, `pin`, `aadhaar_hash`, `aadhaar_last4`, `uan`, `phone`, `whatsapp`, `emergency_contact`, `bank_name`, `account_holder`, `account_number`, `ifsc_code`, `designation`, `category_id FK`, `working_positions`, `photo_url`, `current_site_id FK`, `status`, `profile_id FK nullable`, `registered_by`, `created_at`, `updated_at`.

`employee_sub_ids` columns: `id`, `display_id`, `employee_id FK`, `site_id FK`, `type TEXT` (e.g. "Erection", "Sheeting"), `rate NUMERIC(15,2)`, `salary_basis TEXT` ("Per Day"/"Monthly"), `status`.

`attendance` columns: `id`, `employee_id FK`, `sub_id FK`, `site_id FK`, `month TEXT` (e.g. "2026-10"), `present_days NUMERIC(5,2)`, `ot_hours NUMERIC(5,2) DEFAULT 0`, `salary_basis`, `base_daily_wage NUMERIC(15,2)`, `present_wage NUMERIC(15,2)`, `ot_rate_per_hr NUMERIC(10,2)`, `ot_amount NUMERIC(15,2)`, `total_amount NUMERIC(15,2)`, `status TEXT DEFAULT 'pending'`, `created_at`.

`employee_ledger` columns: `id`, `display_id`, `date DATE`, `employee_id FK`, `sub_id FK nullable`, `site_id FK`, `type TEXT` ("credit"/"debit"), `particulars TEXT`, `credit_amount NUMERIC(15,2) DEFAULT 0`, `debit_amount NUMERIC(15,2) DEFAULT 0`, `reference_id TEXT`, `created_at`.

`site_tagging` columns: `id`, `employee_id FK`, `site_id FK`, `from_site TEXT`, `to_site TEXT`, `tagged_date DATE`, `tagged_by TEXT`, `status TEXT DEFAULT 'active'`, `created_at`.

`site_leaves` columns: `id`, `date DATE`, `employee_id FK`, `site_id FK`, `reason TEXT`, `status TEXT DEFAULT 'pending'`, `created_at`.

- [ ] **Step 4: Write `00004_party_tables.sql`**

Tables: `contractors`, `products`, `site_orders`, `site_order_items`, `supervisors`, `supervisor_site_tagging`, `retailer_categories`, `retailers`.

`contractors` columns: `id`, `display_id`, `name`, `phone`, `email`, `pan`, `gst_number`, `category`, `address`, `tds_applicable BOOLEAN`, `tds_percent NUMERIC(5,2)`, `avatar_url`, `status`, `created_at`, `updated_at`.

`site_orders` columns: `id`, `display_id`, `date DATE`, `site_id FK`, `contractor_id FK`, `base_amount NUMERIC(15,2)`, `gst_amount NUMERIC(15,2)`, `tds_amount NUMERIC(15,2)`, `net_amount NUMERIC(15,2)`, `gst_applied BOOLEAN`, `tds_applicable BOOLEAN`, `tds_percent NUMERIC(5,2)`, `status`, `created_at`.

`site_order_items` columns: `id`, `order_id FK`, `name`, `hsn`, `unit`, `price NUMERIC(15,2)`, `qty NUMERIC(15,3)`, `base_total NUMERIC(15,2)`, `gst_percent NUMERIC(5,2)`, `gst_amount NUMERIC(15,2)`, `net_total NUMERIC(15,2)`.

`supervisors` columns: `id`, `display_id`, `employee_id FK nullable`, `name`, `contact`, `address`, `profile_id FK` (→ profiles, for login), `assigned_site_id FK`, `status`, `created_at`.

`retailers` columns: `id`, `display_id`, `category_id FK`, `name`, `phone`, `address`, `gst_status TEXT` ("YES"/"NO"), `gst_number`, `site_id FK`, `status`, `created_at`, `updated_at`.

- [ ] **Step 5: Write `00005_financial_tables.sql`**

Tables: `retailer_bills`, `retailer_bill_items`, `purchase_orders`, `purchase_order_items`, `invoices`, `balance_received`, `payments`, `income_expenses`, `company_loans`, `company_emis`.

`retailer_bills` columns: `id`, `display_id`, `date DATE`, `inv_type TEXT` ("WITH"/"WITHOUT"), `inv_no TEXT`, `category TEXT`, `retailer_name TEXT`, `retailer_id FK nullable`, `site_id FK`, `gst_applicable BOOLEAN`, `gst_number TEXT`, `total_amount NUMERIC(15,2)`, `paid_amount NUMERIC(15,2) DEFAULT 0`, `due_amount NUMERIC(15,2)`, `status TEXT` ("DUE"/"PAID"), `file_path TEXT`, `created_at`.

`retailer_bill_items` columns: `id`, `bill_id FK`, `item TEXT`, `qty NUMERIC(15,3)`, `unit TEXT`, `price NUMERIC(15,2)`, `gst_percent NUMERIC(5,2) DEFAULT 0`, `line_total NUMERIC(15,2)`, `line_gst NUMERIC(15,2) DEFAULT 0`, `final_total NUMERIC(15,2)`, `add_to_stock BOOLEAN DEFAULT false`.

`payments` columns: `id`, `display_id`, `date DATE`, `category TEXT` ("employee"/"retailer"/"contractor"/"mobilization"/"supervisor_fund"), `party_id BIGINT`, `party_name TEXT`, `party_type TEXT`, `site_id FK`, `amount NUMERIC(15,2)`, `tds_percentage NUMERIC(5,2) DEFAULT 0`, `tds_amount NUMERIC(15,2) DEFAULT 0`, `net_amount NUMERIC(15,2)`, `payment_mode_id FK nullable`, `bank_id FK nullable`, `status TEXT` ("cleared"/"on_hold"/"cancelled"), `remarks TEXT`, `created_by BIGINT`, `created_at`.

`invoices` columns: `id`, `display_id`, `po_id FK nullable`, `company_id FK`, `site_name TEXT`, `date DATE`, `base_amount NUMERIC(15,2)`, `gst_amount NUMERIC(15,2)`, `gross_amount NUMERIC(15,2)`, `is_gst BOOLEAN`, `status TEXT` ("paid"/"unpaid"/"partial"), `file_path TEXT`, `created_at`.

`balance_received` columns: `id`, `invoice_id FK`, `date DATE`, `entry_type TEXT` ("PAYMENT"/"TDS"), `amount NUMERIC(15,2)`, `tds_amount NUMERIC(15,2) DEFAULT 0`, `payment_method TEXT`, `reference_number TEXT`, `remarks TEXT`, `created_at`.

`company_loans` columns: `id`, `display_id`, `loan_id_external TEXT`, `bank TEXT`, `purpose TEXT`, `principal NUMERIC(15,2)`, `interest_type TEXT` ("%"/"₹"), `interest_value NUMERIC(10,2)`, `tenure INT`, `total_payable NUMERIC(15,2)`, `monthly_emi NUMERIC(15,2)`, `due_date INT`, `remind_days INT DEFAULT 5`, `start_date DATE`, `status TEXT` ("active"/"closed"), `created_at`.

`company_emis` columns: `id`, `loan_id FK`, `date DATE`, `ref_no TEXT`, `pay_bank TEXT`, `amount NUMERIC(15,2)`, `created_at`.

`income_expenses` columns: `id`, `date DATE`, `type TEXT` ("Income"/"Expense"), `bank_account TEXT`, `purpose TEXT`, `particulars TEXT`, `remark TEXT`, `amount NUMERIC(15,2)`, `status TEXT DEFAULT 'active'`, `created_at`.

- [ ] **Step 6: Write `00006_stock_tables.sql`**

Tables: `stock_products`, `site_inventory`, `stock_transfers`, `stock_transfer_items`, `damaged_stocks`.

`site_inventory` has UNIQUE constraint on `(product_id, site_id)`. `stock_transfers` tracks `from_site_id`, `to_site_id`, `proof_url`, `status`.

- [ ] **Step 7: Write `00007_settings_tables.sql`**

Tables: `terms_conditions`, `head_allotments`, `equipment_categories`, `equipment_parties`, `equipment_site_assignments`, `vehicles`, `vehicle_service_logs`, `approval_requests`, `activity_logs`, `documents`, `document_folders`.

`approval_requests` columns: `id`, `display_id`, `request_date TIMESTAMPTZ DEFAULT NOW()`, `source TEXT` ("office"/"supervisor"), `requester_id FK → profiles`, `requester_name TEXT`, `site_id FK nullable`, `module TEXT`, `action_type TEXT` ("new_entry"/"edit"/"delete"/"status_toggle"), `reference_id TEXT`, `amount NUMERIC(15,2)`, `old_data JSONB`, `new_data JSONB`, `reason TEXT`, `status TEXT DEFAULT 'pending'` ("pending"/"approved"/"rejected"), `admin_remarks TEXT`, `admin_action_date TIMESTAMPTZ`, `ledger_synced BOOLEAN DEFAULT false`, `created_at TIMESTAMPTZ DEFAULT NOW()`.

- [ ] **Step 8: Run all migrations against Supabase**

Execute via Supabase dashboard SQL editor or `supabase db push`.

- [ ] **Step 9: Verify all tables exist**

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```

Expected: ~35 tables listed.

- [ ] **Step 10: Commit**

---

### Task 3: Auth Middleware + User Routes

**Files:**
- Create: `backend/src/middleware/auth.js`
- Create: `backend/src/middleware/roles.js`
- Create: `backend/src/middleware/sitelock.js`
- Create: `backend/src/middleware/validate.js`
- Create: `backend/src/routes/auth.js`
- Modify: `backend/server.js` (mount auth routes)
- Create: `backend/tests/integration/auth.test.js`

**Interfaces:**
- Consumes: `supabase`, `supabaseAnon` from Task 1; `profiles` table from Task 2
- Produces:
  - `authenticateToken(req, res, next)` — verifies Supabase JWT, sets `req.user = { id, authUid, displayId, name, role, siteId }`
  - `requireRole(...roles)(req, res, next)` — 403 if `req.user.role` not in list
  - `enforceSiteLock(req, res, next)` — for supervisors, ensures request siteId matches `req.user.siteId`
  - `POST /api/auth/signup` — admin-only, creates user in Supabase Auth + profiles row
  - `POST /api/auth/login` — returns Supabase session (access_token + refresh_token)
  - `GET /api/auth/me` — current user profile (no aadhaar)
  - `PUT /api/auth/password` — change own password

- [ ] **Step 1: Write `src/middleware/auth.js`**

Extract `Authorization: Bearer <token>`, call `supabase.auth.getUser(token)` to verify. Look up `profiles` row by `auth_uid`. Set `req.user`. Return 401 on failure.

- [ ] **Step 2: Write `src/middleware/roles.js`**

`requireRole(...allowedRoles)` — returns middleware that checks `req.user.role`. Returns 403 `"Access denied: insufficient role"`.

- [ ] **Step 3: Write `src/middleware/sitelock.js`**

If `req.user.role === 'supervisor'`: extract `siteId` from `req.query.site_id || req.body.site_id || req.params.siteId`. If present and doesn't match `req.user.siteId`, return 403. If not present, inject `req.user.siteId` as the site filter.

- [ ] **Step 4: Write `src/middleware/validate.js`**

Wrapper around express-validator: `validate(validations)` returns middleware that runs validations and returns 400 with errors array if any fail.

- [ ] **Step 5: Write auth routes**

`POST /api/auth/signup` (admin only): body `{ email, password, name, role, displayId, siteId? }`. Creates user via `supabase.auth.admin.createUser()`, then inserts `profiles` row. For employee signup, also accepts `aadhaar` → hashes with bcrypt, stores `aadhaar_hash` and `aadhaar_last4`.

`POST /api/auth/login`: body `{ email, password }`. Calls `supabaseAnon.auth.signInWithPassword()`. Returns `{ access_token, refresh_token, user: profileData }`.

`GET /api/auth/me` (authenticated): queries `profiles` by `req.user.id`. Explicitly excludes `aadhaar_hash` from response.

`PUT /api/auth/password` (authenticated): body `{ newPassword }`. Calls `supabase.auth.admin.updateUserById()`.

- [ ] **Step 6: Mount routes in server.js**

```javascript
app.use('/api/auth', require('./src/routes/auth'));
```

- [ ] **Step 7: Write failing tests**

```javascript
test('POST /api/auth/login with valid credentials returns access_token', ...);
test('POST /api/auth/login with invalid password returns 400', ...);
test('GET /api/auth/me with valid token returns profile without aadhaar_hash', async () => {
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.data).not.toHaveProperty('aadhaar_hash');
  expect(res.body.data).toHaveProperty('name');
});
test('GET /api/auth/me without token returns 401', ...);
test('Supervisor accessing different site via query param returns 403', async () => {
  const res = await request(app).get('/api/employees?site_id=999')
    .set('Authorization', `Bearer ${supervisorToken}`);
  expect(res.status).toBe(403);
});
test('Admin accessing any site returns 200', ...);
```

- [ ] **Step 8: Run tests, verify pass**

- [ ] **Step 9: Seed default admin user**

Create `backend/seeds/seed_admin.js`: calls `supabase.auth.admin.createUser()` with email from env, then inserts profiles row with `role: 'admin'`, `display_id: 'ADM-001'`. Only runs if no admin profile exists.

- [ ] **Step 10: Commit**

---

### Task 4: Employee Module + OT Calculation Service

**Files:**
- Create: `backend/src/services/otCalculation.js`
- Create: `backend/src/routes/employees.js`
- Create: `backend/src/routes/attendance.js`
- Modify: `backend/server.js` (mount routes)
- Create: `backend/tests/unit/otCalculation.test.js`
- Create: `backend/tests/integration/employees.test.js`
- Create: `backend/tests/integration/attendance.test.js`

**Interfaces:**
- Consumes: `supabase` from Task 1; auth/roles/sitelock middleware from Task 3; `employees`, `employee_categories`, `employee_sub_ids`, `site_tagging`, `attendance`, `site_leaves`, `employee_ledger` tables from Task 2
- Produces:
  - `calculateOT(salaryBasis, baseDailyWage, daysCount, otHours) → { presentWage, otRatePerHr, otAmount, totalAmount }`
  - Employee CRUD: `GET/POST/PUT/DELETE /api/employees`, `GET/POST /api/employees/:id/sub-ids`
  - Categories: `GET/POST/PUT/DELETE /api/employee-categories`
  - Site tagging: `POST /api/site-tagging`, `GET /api/site-tagging?employee_id=X`
  - Attendance: `GET/POST /api/attendance`, `GET /api/employee-ledger/:employeeId`
  - Site leave: `GET/POST /api/site-leaves`

- [ ] **Step 1: Write failing OT unit tests**

```javascript
const { calculateOT } = require('../../src/services/otCalculation');

test('Per Day: 800/day, 5 days, 4 OT hrs → wage 4000, otRate 100, ot 400, total 4400', () => {
  const r = calculateOT('Per Day', 800, 5, 4);
  expect(r.presentWage).toBe(4000);
  expect(r.otRatePerHr).toBe(100);
  expect(r.otAmount).toBe(400);
  expect(r.totalAmount).toBe(4400);
});

test('Monthly: 500/day, 26 days, 10 OT hrs → ot always 0, total 13000', () => {
  const r = calculateOT('Monthly', 500, 26, 10);
  expect(r.otAmount).toBe(0);
  expect(r.totalAmount).toBe(13000);
});

test('Per Day with 0 otHours → otAmount 0, not NaN', () => {
  const r = calculateOT('Per Day', 800, 5, 0);
  expect(r.otAmount).toBe(0);
  expect(r.totalAmount).toBe(4000);
});

test('Per Day with fractional wage: 750/day, 3 days, 2 OT hrs → rounded', () => {
  const r = calculateOT('Per Day', 750, 3, 2);
  expect(r.presentWage).toBe(2250);
  expect(r.otRatePerHr).toBe(93.75);
  expect(r.otAmount).toBe(188); // Math.round(93.75 * 2)
  expect(r.totalAmount).toBe(2438);
});
```

- [ ] **Step 2: Run unit tests, verify they fail**

- [ ] **Step 3: Implement `otCalculation.js`**

```javascript
function calculateOT(salaryBasis, baseDailyWage, daysCount, otHours) {
  const presentWage = Math.round(baseDailyWage * daysCount);
  let otRatePerHr = 0;
  let otAmount = 0;
  if (salaryBasis === 'Per Day' && otHours > 0) {
    otRatePerHr = baseDailyWage / 8;
    otAmount = Math.round(otRatePerHr * otHours);
  }
  return { presentWage, otRatePerHr, otAmount, totalAmount: presentWage + otAmount };
}
module.exports = { calculateOT };
```

- [ ] **Step 4: Run unit tests, verify pass**

- [ ] **Step 5: Write employee routes**

`GET /api/employees` — joins `employee_categories`, filters by `site_id`, `status`, `category_id`. Supervisor sees only own site (via sitelock). Returns array without `aadhaar_hash`.

`POST /api/employees` — admin: inserts directly + auto-creates Supabase Auth user (email = `{displayId}@atr.local`, password = raw aadhaar) + profiles row with `role: 'employee'`. Office/supervisor: creates approval request instead.

`PUT /api/employees/:id` — admin: direct update. Office/supervisor: approval request.

`DELETE /api/employees/:id` — soft delete (status → 'inactive'). Admin only.

`GET/POST /api/employee-categories` — CRUD for position categories (name + working days).

`POST /api/employees/:id/sub-ids` — creates sub-ID record linked to employee and site. Auto-generates display_id `SUB-XXXX`.

`POST /api/site-tagging` — body `{ employeeId, siteId }`. Updates employee's `current_site_id`, creates `site_tagging` log entry.

- [ ] **Step 6: Write attendance routes**

`POST /api/attendance` — body `{ employeeId, subId, siteId, month, presentDays, otHours }`. Looks up sub-ID to get `rate` and `salary_basis`. Calls `calculateOT()` to compute all wage fields. Admin: saves directly + creates employee_ledger Credit entry. Supervisor: creates approval request.

`GET /api/attendance` — filters by `employee_id`, `site_id`, `month`. Supervisor: auto-filtered to own site.

`GET /api/employee-ledger/:employeeId` — returns all credit/debit entries ordered by date. Computes running balance. Employee role: can only access own ledger (`req.user.id` must match).

`POST /api/site-leaves` — body `{ date, employeeId, siteId, reason }`.

- [ ] **Step 7: Write integration tests**

```javascript
test('Create employee auto-generates display_id', async () => {
  const res = await adminRequest.post('/api/employees').send(employeeData);
  expect(res.status).toBe(201);
  expect(res.body.data.display_id).toMatch(/^EMP-\d+$/);
});

test('Employee ledger shows credit after attendance creation', async () => {
  await adminRequest.post('/api/attendance').send(attendanceData);
  const res = await adminRequest.get(`/api/employee-ledger/${empId}`);
  expect(res.body.data[0].type).toBe('credit');
  expect(res.body.data[0].credit_amount).toBeGreaterThan(0);
});

test('Supervisor can only list employees from own site', async () => {
  const res = await supervisorRequest.get('/api/employees');
  res.body.data.forEach(emp => {
    expect(emp.current_site_id).toBe(supervisorSiteId);
  });
});
```

- [ ] **Step 8: Run all tests, verify pass**

- [ ] **Step 9: Commit**

---

### Task 5: Payment Module + TDS/Settlement Services

**Files:**
- Create: `backend/src/services/tdsCalculation.js`
- Create: `backend/src/services/settlementCalc.js`
- Create: `backend/src/routes/payments.js`
- Modify: `backend/server.js` (mount routes)
- Create: `backend/tests/unit/tdsCalculation.test.js`
- Create: `backend/tests/unit/settlementCalc.test.js`
- Create: `backend/tests/integration/payments.test.js`

**Interfaces:**
- Consumes: auth/roles/sitelock from Task 3; `payments`, `payment_modes`, `employee_ledger` tables from Task 2; `calculateOT` from Task 4
- Produces:
  - `calculateTDS(grossAmount, tdsPercentage) → { tdsAmount, netAmount }`
  - `calculateSettlement(totalDue, payingAmount) → { remaining, isFullySettled }`
  - `GET/POST/PUT/DELETE /api/payments`
  - `GET/POST /api/payment-modes`

- [ ] **Step 1: Write failing TDS unit tests**

```javascript
const { calculateTDS } = require('../../src/services/tdsCalculation');

test('TDS 2% on 100000 → tds 2000, net 98000', () => {
  const r = calculateTDS(100000, 2);
  expect(r.tdsAmount).toBe(2000);
  expect(r.netAmount).toBe(98000);
});

test('TDS 0% → net equals gross exactly', () => {
  const r = calculateTDS(50000, 0);
  expect(r.tdsAmount).toBe(0);
  expect(r.netAmount).toBe(50000);
});

test('TDS 1.5% on 75000 → tds 1125, net 73875', () => {
  const r = calculateTDS(75000, 1.5);
  expect(r.tdsAmount).toBe(1125);
  expect(r.netAmount).toBe(73875);
});
```

- [ ] **Step 2: Write failing settlement tests**

```javascript
const { calculateSettlement } = require('../../src/services/settlementCalc');

test('50000 due, 30000 paid → 20000 remaining, not settled', () => {
  const r = calculateSettlement(50000, 30000);
  expect(r.remaining).toBe(20000);
  expect(r.isFullySettled).toBe(false);
});

test('50000 due, 50000 paid → 0 remaining, fully settled', () => {
  const r = calculateSettlement(50000, 50000);
  expect(r.remaining).toBe(0);
  expect(r.isFullySettled).toBe(true);
});
```

- [ ] **Step 3: Run unit tests, verify they fail**

- [ ] **Step 4: Implement `tdsCalculation.js` and `settlementCalc.js`**

TDS: `tdsAmount = parseFloat((gross * pct / 100).toFixed(2))`, `netAmount = parseFloat((gross - tdsAmount).toFixed(2))`.
Settlement: `remaining = totalDue - payingAmount`, `isFullySettled = remaining <= 0`.

- [ ] **Step 5: Run unit tests, verify pass**

- [ ] **Step 6: Write payment routes**

`POST /api/payments` — body `{ date, category, partyId, partyName, partyType, siteId, amount, tdsPercentage, paymentModeId, bankId, remarks }`.

Role logic:
- Admin: `status = 'cleared'`, all categories allowed, calls `calculateTDS` if contractor/mobilization.
- Supervisor: `status = 'on_hold'`, only `employee` and `retailer` categories allowed, `bank_id` forced to null.
- Office: creates approval request.

On employee payment with status 'cleared': creates `employee_ledger` Debit entry.

`GET /api/payments` — filters by `category`, `site_id`, `status`, date range. Supervisor auto-filtered to own site.

`GET/POST /api/payment-modes` — admin-only for create. List available to all authenticated.

- [ ] **Step 7: Write integration tests**

```javascript
test('Supervisor can only create employee and retailer payments', async () => {
  const res = await supervisorRequest.post('/api/payments')
    .send({ ...paymentData, category: 'contractor' });
  expect(res.status).toBe(403);
});

test('Supervisor payment saves with status on_hold', async () => {
  const res = await supervisorRequest.post('/api/payments')
    .send({ ...paymentData, category: 'employee' });
  expect(res.body.data.status).toBe('on_hold');
});

test('Admin payment with TDS deducts correctly', async () => {
  const res = await adminRequest.post('/api/payments')
    .send({ ...paymentData, category: 'contractor', amount: 100000, tdsPercentage: 2 });
  expect(res.body.data.tds_amount).toBe(2000);
  expect(res.body.data.net_amount).toBe(98000);
});

test('Employee payment creates debit in employee_ledger', async () => {
  await adminRequest.post('/api/payments').send({ ...empPaymentData, category: 'employee' });
  const ledger = await adminRequest.get(`/api/employee-ledger/${empId}`);
  const debitEntry = ledger.body.data.find(e => e.type === 'debit');
  expect(debitEntry).toBeDefined();
  expect(debitEntry.debit_amount).toBe(empPaymentData.amount);
});
```

- [ ] **Step 8: Run tests, verify pass**

- [ ] **Step 9: Commit**

---

### Task 6: Approval Engine

**Files:**
- Create: `backend/src/services/approvalEngine.js`
- Create: `backend/src/routes/approvals.js`
- Modify: `backend/server.js` (mount routes)
- Create: `backend/tests/integration/approvals.test.js`

**Interfaces:**
- Consumes: `supabase` from Task 1; auth/roles from Task 3; `approval_requests`, `activity_logs`, `employee_ledger` tables from Task 2; `calculateOT` from Task 4
- Produces:
  - `createApprovalRequest(data) → approvalRequest` — validates and inserts
  - `processApproval(requestId, action, adminRemarks, adminId) → updatedRequest` — approve/reject with ledger sync
  - `GET /api/approvals` — list (admin: all; office/supervisor: own)
  - `GET /api/approvals/pending-counts` — `{ office, supervisor, loans }`
  - `PUT /api/approvals/:id/approve` — admin only
  - `PUT /api/approvals/:id/reject` — admin only, remarks required

- [ ] **Step 1: Write `approvalEngine.js`**

`createApprovalRequest({ source, requesterId, requesterName, siteId, module, actionType, referenceId, amount, oldData, newData, reason })` — inserts into `approval_requests` with `status: 'pending'`.

`processApproval(requestId, action, adminRemarks, adminId)`:
1. Fetch request with `FOR UPDATE` (use Supabase RPC or raw SQL for row lock)
2. If `status !== 'pending'`, throw `{ status: 409, message: 'Already processed' }`
3. If `action === 'rejected'` and `!adminRemarks`, throw `{ status: 400, message: 'Remarks required for rejection' }`
4. Update `status`, `admin_remarks`, `admin_action_date`
5. If approved and module is "Attendance": compute OT from `new_data`, insert `employee_ledger` Credit, set `ledger_synced = true`
6. If approved and module is "Payment": insert `employee_ledger` Debit, set `ledger_synced = true`
7. If approved and module is entity CRUD (employee/contractor/retailer/etc.): apply `new_data` to the target table
8. Insert `activity_logs` entry

- [ ] **Step 2: Write approval routes**

`POST /api/approvals` — office/supervisor only. Calls `createApprovalRequest`.

`GET /api/approvals` — query params: `status`, `source`, `module`. Admin sees all. Office/supervisor see own (`requester_id = req.user.id`).

`GET /api/approvals/pending-counts` — admin only. Returns counts for dashboard bell icon.

`PUT /api/approvals/:id/approve` — admin only. Calls `processApproval(id, 'approved', body.remarks, req.user.id)`.

`PUT /api/approvals/:id/reject` — admin only. Calls `processApproval(id, 'rejected', body.remarks, req.user.id)`.

- [ ] **Step 3: Write failing tests**

```javascript
test('Office user can submit approval request', async () => {
  const res = await officeRequest.post('/api/approvals').send(approvalData);
  expect(res.status).toBe(201);
  expect(res.body.data.status).toBe('pending');
});

test('Admin can approve pending request', async () => {
  const res = await adminRequest.put(`/api/approvals/${reqId}/approve`).send({ remarks: 'OK' });
  expect(res.status).toBe(200);
  expect(res.body.data.status).toBe('approved');
});

test('Rejection without remarks returns 400', async () => {
  const res = await adminRequest.put(`/api/approvals/${reqId}/reject`).send({});
  expect(res.status).toBe(400);
});

test('Double-approve same request returns 409', async () => {
  await adminRequest.put(`/api/approvals/${reqId}/approve`).send({ remarks: 'OK' });
  const res = await adminRequest.put(`/api/approvals/${reqId}/approve`).send({ remarks: 'Again' });
  expect(res.status).toBe(409);
});

test('Attendance approval creates credit in employee ledger', async () => {
  const attendanceReq = await officeRequest.post('/api/approvals').send({
    ...approvalData, module: 'Attendance', new_data: attendancePayload
  });
  await adminRequest.put(`/api/approvals/${attendanceReq.body.data.id}/approve`).send({ remarks: 'OK' });
  const ledger = await adminRequest.get(`/api/employee-ledger/${empId}`);
  expect(ledger.body.data.some(e => e.type === 'credit')).toBe(true);
});

test('Pending counts returns correct numbers', async () => {
  const res = await adminRequest.get('/api/approvals/pending-counts');
  expect(res.body.data).toHaveProperty('office');
  expect(res.body.data).toHaveProperty('supervisor');
});
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

---

### Task 7: Core Entity Routes (Companies, Sites, Banks, Contractors, Supervisors, Retailers)

**Files:**
- Create: `backend/src/routes/companies.js`
- Create: `backend/src/routes/sites.js`
- Create: `backend/src/routes/banks.js`
- Create: `backend/src/routes/contractors.js`
- Create: `backend/src/routes/supervisors.js`
- Create: `backend/src/routes/retailers.js`
- Modify: `backend/server.js` (mount all routes)

**Interfaces:**
- Consumes: `supabase` from Task 1; auth/roles/sitelock from Task 3; `createApprovalRequest` from Task 6; all party tables from Task 2
- Produces:
  - `GET/POST/PUT/DELETE /api/companies`
  - `GET/POST/PUT/DELETE /api/sites`
  - `GET/POST/PUT/DELETE /api/banks`
  - `GET/POST/PUT/DELETE /api/contractors`
  - `GET/POST/PUT/DELETE /api/supervisors` (create also creates profiles + Supabase Auth user)
  - `GET/POST/PUT/DELETE /api/retailers`
  - `GET/POST /api/retailer-categories`

- [ ] **Step 1: Write company, site, bank routes**

Standard CRUD pattern: admin full access, office creates approval request for create/edit/delete, supervisor read-only. Companies support `custom_fields` JSONB. Sites reference `company_id`.

- [ ] **Step 2: Write contractor routes**

CRUD with TDS fields (`tds_applicable`, `tds_percent`). Admin delete requires password confirmation (check via `supabase.auth.signInWithPassword` for the admin).

- [ ] **Step 3: Write supervisor routes**

`POST /api/supervisors` — creates supervisor record + Supabase Auth user + profiles row with `role: 'supervisor'` and `assigned_site_id`. Links to employee via `employee_id` if provided.

- [ ] **Step 4: Write retailer routes**

CRUD with `gst_status`, `gst_number`. Supervisor: site-locked (only see retailers for own site). `GET/POST /api/retailer-categories` for category management.

- [ ] **Step 5: Write basic CRUD test for companies**

```javascript
test('Admin can create and list companies', async () => {
  const create = await adminRequest.post('/api/companies').send({ name: 'Test Corp', phone: '9876543210' });
  expect(create.status).toBe(201);
  const list = await adminRequest.get('/api/companies');
  expect(list.body.data.length).toBeGreaterThan(0);
});
```

- [ ] **Step 6: Run tests, verify pass**

- [ ] **Step 7: Commit**

---

### Task 8: Sales Module (Invoices, POs, Balance Received) + Retailer Bills

**Files:**
- Create: `backend/src/routes/invoices.js`
- Create: `backend/src/routes/purchaseOrders.js`
- Create: `backend/src/routes/retailers.js` (extend with bills endpoints)
- Create: `backend/src/routes/loans.js`
- Modify: `backend/server.js` (mount routes)

**Interfaces:**
- Consumes: `supabase` from Task 1; auth/roles from Task 3; `calculateTDS` from Task 5; company/site data from Task 7
- Produces:
  - `GET/POST/PUT/DELETE /api/purchase-orders` (with nested items)
  - `GET/POST/PUT/DELETE /api/invoices`
  - `GET/POST /api/balance-received`
  - `GET/POST/PUT/DELETE /api/retailer-bills` (with nested cart items)
  - `GET /api/retailer-bills/gst-report` — bills where `gst_applicable = true`
  - `GET /api/retailer-bills/non-gst-report` — bills where `gst_applicable = false`
  - `GET/POST/PUT /api/loans` + `GET/POST /api/loans/:id/emis`
  - `GET /api/loans/reminders` — EMIs due within remind window

- [ ] **Step 1: Write purchase order routes**

`POST /api/purchase-orders` — body includes `items[]` array. Each item has `name`, `hsn`, `unit`, `price`, `qty`, `gst_percent`. Percentage unit logic: if `unit` is "%" or "Percentage", `base_total = (price * qty) / 100`. Otherwise `base_total = price * qty`. Inserts `purchase_orders` + `purchase_order_items`.

- [ ] **Step 2: Write invoice routes**

`POST /api/invoices` — `gross_amount = base_amount + gst_amount`. Links to PO via `po_id`. Status defaults to `'unpaid'`.

`POST /api/balance-received` — body `{ invoiceId, date, amount, tdsAmount, paymentMethod, referenceNumber }`. After insert, recalculate invoice status: sum all `balance_received.amount` for this invoice. If `totalReceived >= invoice.gross_amount`, update invoice `status = 'paid'`. If partial, `status = 'partial'`.

- [ ] **Step 3: Write retailer bill routes**

`POST /api/retailer-bills` — body includes `cart_items[]`. Each item: percentage unit logic same as POs. `line_gst = line_total * gst_percent / 100`. `final_total = line_total + line_gst`. Bill `total_amount = sum(final_total)`. `due_amount = total_amount - paid_amount`.

GST/Non-GST report endpoints filter by `gst_applicable`.

- [ ] **Step 4: Write loan routes**

`POST /api/loans` — computes `total_payable`: if `interest_type === '%'`, then `total_payable = principal + (principal * interest_value / 100 * tenure / 12)`; if `interest_type === '₹'`, then `total_payable = principal + (interest_value * tenure)`. `monthly_emi = total_payable / tenure`.

`GET /api/loans/reminders` — active loans where: current day of month is within `due_date ± remind_days` AND no EMI record exists for current month.

- [ ] **Step 5: Write test for balance-received invoice status sync**

```javascript
test('Balance received updates invoice to paid when fully settled', async () => {
  const inv = await adminRequest.post('/api/invoices').send({ ...invoiceData, gross_amount: 10000 });
  await adminRequest.post('/api/balance-received').send({ invoiceId: inv.body.data.id, amount: 10000 });
  const updated = await adminRequest.get(`/api/invoices/${inv.body.data.id}`);
  expect(updated.body.data.status).toBe('paid');
});
```

- [ ] **Step 6: Run tests, verify pass**

- [ ] **Step 7: Commit**

---

### Task 9: Stock, Equipment, Vehicles + Income/Expense

**Files:**
- Create: `backend/src/routes/stock.js`
- Create: `backend/src/routes/equipment.js`
- Create: `backend/src/routes/vehicles.js`
- Modify: `backend/server.js` (mount routes)

**Interfaces:**
- Consumes: `supabase` from Task 1; auth/roles/sitelock from Task 3; site data from Task 7
- Produces:
  - `GET/POST /api/stock-products`
  - `GET/POST /api/site-inventory` (current stock per site)
  - `POST /api/stock-transfers` (deduct source, add destination)
  - `POST /api/damaged-stocks`
  - `GET /api/stock-report` (submitted vs damaged per site/item)
  - `GET/POST/PUT/DELETE /api/equipment`
  - `GET/POST /api/equipment-site-assignments`
  - `GET/POST/PUT/DELETE /api/vehicles`
  - `GET/POST /api/vehicles/:id/service-logs`
  - `GET/POST/PUT/DELETE /api/income-expenses`

- [ ] **Step 1: Write stock routes**

`POST /api/stock-transfers` — body `{ fromSiteId, toSiteId, items: [{ productId, qty }] }`. For each item: check `site_inventory` has sufficient qty at source. Deduct from source, add to destination (upsert on unique `product_id + site_id`). Return 400 if insufficient.

`POST /api/damaged-stocks` — records damaged qty. Reduces available stock in `site_inventory`.

- [ ] **Step 2: Write equipment routes**

CRUD for `equipment_parties` (the mobilization parties). `equipment_site_assignments` tracks which equipment is at which site with status: Active/Left/Transferred.

- [ ] **Step 3: Write vehicle routes**

CRUD for `vehicles`. Nested `GET/POST /api/vehicles/:id/service-logs` for maintenance records with `next_due` date.

- [ ] **Step 4: Write income/expense routes**

`GET /api/income-expenses` — returns all entries with computed summary: `{ totalIncome, totalExpense, netBalance }`. Filters by `type`, `purpose`, date range.

- [ ] **Step 5: Write stock transfer test**

```javascript
test('Stock transfer deducts source and adds to destination', async () => {
  // Seed: 100 units at site 1
  const res = await adminRequest.post('/api/stock-transfers').send({
    fromSiteId: site1Id, toSiteId: site2Id, items: [{ productId: prodId, qty: 30 }]
  });
  expect(res.status).toBe(201);
  const inv1 = await adminRequest.get(`/api/site-inventory?site_id=${site1Id}&product_id=${prodId}`);
  expect(inv1.body.data[0].quantity).toBe(70);
  const inv2 = await adminRequest.get(`/api/site-inventory?site_id=${site2Id}&product_id=${prodId}`);
  expect(inv2.body.data[0].quantity).toBe(30);
});

test('Transfer with insufficient stock returns 400', async () => {
  const res = await adminRequest.post('/api/stock-transfers').send({
    fromSiteId: site1Id, toSiteId: site2Id, items: [{ productId: prodId, qty: 9999 }]
  });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 6: Run tests, verify pass**

- [ ] **Step 7: Commit**

---

### Task 10: Settings, Documents, Backup

**Files:**
- Create: `backend/src/routes/settings.js`
- Create: `backend/src/routes/documents.js`
- Create: `backend/src/routes/backup.js`
- Modify: `backend/server.js` (mount routes)

**Interfaces:**
- Consumes: `supabase` from Task 1; auth/roles from Task 3; `createApprovalRequest` from Task 6; Supabase Storage
- Produces:
  - `GET/POST/PUT/DELETE /api/settings/terms` (T&C)
  - `GET/POST/PUT/DELETE /api/settings/heads` (expense heads with parent-child hierarchy)
  - `GET/PUT /api/settings/menus` (menu allotments per user)
  - `GET/POST /api/settings/employee-categories` (alias, also in Task 4)
  - `GET/POST /api/settings/equipment-categories`
  - `GET/POST /api/settings/retailer-categories` (alias, also in Task 7)
  - `GET/POST/DELETE /api/documents`
  - `GET/POST/DELETE /api/document-folders`
  - `POST /api/backup/export` — admin only, all tables → JSON zip
  - `POST /api/backup/import` — admin only, restore from zip

- [ ] **Step 1: Write settings routes**

T&C: office creates → approval request. Admin creates directly. Head allotments support `parent_head` for hierarchy.

Menu allotments: `PUT /api/settings/menus` — body `{ profileId, menuItems: [{ menuItemId, menuName, menuUrl, granted }] }`. Replaces all allotments for that profile.

- [ ] **Step 2: Write document routes using Supabase Storage**

`POST /api/documents` — upload file to Supabase Storage bucket `documents`. Insert metadata into `documents` table. Use `supabase.storage.from('documents').upload(path, file)`.

`GET /api/documents/:id/download` — get signed URL from Supabase Storage, redirect or return URL.

`DELETE /api/documents/:id` — admin only. Delete from Storage + DB.

- [ ] **Step 3: Write backup routes**

`POST /api/backup/export` — admin only. Query all tables, build JSON object `{ companies: [...], employees: [...], ... }`. Return as downloadable JSON file.

`POST /api/backup/import` — admin only. Accept JSON file. Validate structure. Truncate + re-insert all tables within a transaction (using Supabase RPC for transaction support).

- [ ] **Step 4: Write test for document upload**

```javascript
test('Admin can upload and download a document', async () => {
  const upload = await adminRequest.post('/api/documents')
    .attach('file', Buffer.from('test'), 'test.pdf')
    .field('folder_id', folderId);
  expect(upload.status).toBe(201);
  const download = await adminRequest.get(`/api/documents/${upload.body.data.id}/download`);
  expect(download.status).toBe(200);
});
```

- [ ] **Step 5: Run tests, verify pass**

- [ ] **Step 6: Commit**

---

### Task 11: Reports + Dashboard KPIs

**Files:**
- Create: `backend/src/services/reportAggregator.js`
- Create: `backend/src/routes/reports.js`
- Modify: `backend/server.js` (mount routes)
- Create: `backend/tests/integration/reports.test.js`

**Interfaces:**
- Consumes: All models/tables from Tasks 2-10; `supabase` from Task 1; auth/roles from Task 3
- Produces:
  - `GET /api/dashboard/kpis` — top-level stats for admin dashboard
  - `GET /api/dashboard/pending-dues` — entities with outstanding balances
  - `GET /api/dashboard/notifications` — pending approval counts (for bell icon)
  - `GET /api/reports/site-ledger?company_id=X&site_id=Y` — 4-section site report
  - `GET /api/reports/mobilization?site_id=X&party_id=Y&from=DATE&to=DATE`
  - `GET /api/reports/sales?company_id=X&fy=YYYY`
  - `GET /api/ledger/employee/:id` — Tally-style with running balance
  - `GET /api/ledger/contractor/:id`
  - `GET /api/ledger/retailer/:id`
  - `GET /api/ledger/supervisor/:id`
  - `GET /api/ledger/company/:id`

- [ ] **Step 1: Write `reportAggregator.js`**

`getDashboardKPIs()` — counts: active sites, active employees, contractors, supervisors, retailers, total bank balance (sum of `banks.opening_balance`).

`getPendingDues()` — employees with positive due balance (sum credits - sum debits from employee_ledger), contractors with unpaid site orders, retailers with unpaid bills.

`getNotificationCounts()` — count `approval_requests` WHERE `status = 'pending'` grouped by `source`.

`getSiteLedger(companyId, siteId)` — aggregates by month: employee attendance expenses, mobilization (equipment party) expenses, retailer purchase expenses, contractor payments. Returns section totals + grand total.

`getEntityLedger(entityType, entityId, dateFrom, dateTo)` — generic ledger builder. Collects all payments (debits) and earnings/bills (credits) for the entity. Returns chronological array with running balance: `{ date, particulars, debit, credit, balance }`.

- [ ] **Step 2: Write report routes**

Each route calls the appropriate aggregator function, applies auth guards (employee can only see own ledger), and returns via `sendSuccess`.

- [ ] **Step 3: Write tests**

```javascript
test('Dashboard KPIs returns counts', async () => {
  const res = await adminRequest.get('/api/dashboard/kpis');
  expect(res.body.data).toHaveProperty('activeSites');
  expect(res.body.data).toHaveProperty('activeEmployees');
  expect(res.body.data).toHaveProperty('totalBankBalance');
});

test('Notification counts match pending approvals', async () => {
  const res = await adminRequest.get('/api/dashboard/notifications');
  expect(typeof res.body.data.office).toBe('number');
  expect(typeof res.body.data.supervisor).toBe('number');
});

test('Employee ledger has running balance', async () => {
  const res = await adminRequest.get(`/api/ledger/employee/${empId}`);
  const entries = res.body.data;
  expect(entries.length).toBeGreaterThan(0);
  entries.forEach(e => expect(e).toHaveProperty('balance'));
});
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

---

### Task 12: Demo Seeds + Final Integration

**Files:**
- Create: `backend/seeds/demo_data.sql`
- Create: `backend/seeds/seed_demo.js` (runner script)
- Create: `backend/API_ROUTES.md`
- Modify: `backend/package.json` (add seed script)

**Interfaces:**
- Consumes: All tables from Task 2, all routes from Tasks 3-11
- Produces: `npm run seed` populates DB with demo data matching current HTML hardcoded data; `API_ROUTES.md` documents every endpoint

- [ ] **Step 1: Write `seeds/demo_data.sql`**

Insert demo data matching what the HTML files currently hardcode:
- 2 companies (ATR Construction, Silvergate Infra)
- 5 sites (Dum Dum Project, Salt Lake Sector V, Rajarhat Township, Howrah Bridge Repair, Barrackpore Complex)
- 3 bank accounts
- 5 employees with categories and sub-IDs
- 3 contractors
- 3 supervisors (tagged to sites)
- 5 retailers across categories
- Sample attendance, payments, invoices, stock entries
- 3 payment modes (NEFT, UPI, Cash)

- [ ] **Step 2: Write `seeds/seed_demo.js`**

Node script that reads `demo_data.sql` and executes via `supabase.rpc()` or raw SQL. Also creates Supabase Auth users for the demo admin, office users, supervisors, and employees.

- [ ] **Step 3: Add npm scripts**

```json
"seed": "node seeds/seed_demo.js",
"start": "node server.js",
"dev": "node --watch server.js",
"test": "jest --runInBand"
```

- [ ] **Step 4: Write `API_ROUTES.md`**

Document every endpoint grouped by module: method, path, auth required, role required, request body, response shape, error codes.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Run seed against clean database, verify via Supabase Studio**

Verify in Supabase dashboard that all tables have demo data.

- [ ] **Step 7: Final commit**
