# Database Setup Guide — ATR ConstructPro

This guide walks you through configuring Supabase as the backend database for ATR ConstructPro.

---

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- Node.js 20+ installed
- `npm install` completed in the `backend/` directory

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Fill in:
   - **Project name**: `atr-constructpro` (or any name)
   - **Database password**: choose a strong password (save it — you may need it later for direct DB access)
   - **Region**: pick one close to your users (e.g., `ap-south-1` for India)
4. Click **Create new project** and wait ~2 minutes for provisioning

---

## Step 2: Get Your API Keys

1. In the Supabase dashboard, go to **Settings** (gear icon, bottom-left sidebar)
2. Click **API Keys**
3. Click the **"Legacy anon, service_role API keys"** tab
4. You need two keys:

| Label | Description |
|-------|-------------|
| **anon public** | Safe for client-side use. Used for authentication operations |
| **service_role secret** | Full database access. Used by the backend server. **Keep this secret!** |

5. Also note your **Project URL** (visible at the top of the API settings page):
   ```
   https://<your-project-id>.supabase.co
   ```

---

## Step 3: Create the `.env` File

Create a file named `.env` in the `backend/` directory:

```env
# Supabase Configuration
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...your-service-role-key...

# Admin Seed User Credentials
ADMIN_EMAIL=admin@atr.com
DEFAULT_ADMIN_PASSWORD=YourStrongPassword123

# Server Port
PORT=3000
```

Replace the placeholder values with your actual Supabase keys.

> **Important:** Never commit `.env` to git. It is already listed in `.gitignore`.

---

## Step 4: Run Database Migrations

The database schema consists of 47 tables across 11 migration files. You have two options:

### Option A: Run All Migrations at Once (Recommended)

1. Open the Supabase **SQL Editor**:
   ```
   https://supabase.com/dashboard/project/<your-project-id>/sql/new
   ```
2. Open `backend/all_migrations.sql` in your code editor
3. Select All (Ctrl+A) → Copy (Ctrl+C)
4. Paste into the SQL Editor → Click **Run**
5. You should see "Success. No rows returned"

### Option B: Run Migrations One by One

If you prefer to run them individually, execute each file in order in the SQL Editor:

```
backend/supabase/migrations/
├── 00001_profiles_and_auth.sql      → Profiles, menu allotments
├── 00002_core_tables.sql            → Companies, sites, banks, payment modes
├── 00003_employee_tables.sql        → Employees, categories, attendance, ledger
├── 00004_party_tables.sql           → Contractors, supervisors, retailers
├── 00005_financial_tables.sql       → Bills, POs, invoices, payments, loans
├── 00006_stock_tables.sql           → Stock products, inventory, transfers
├── 00007_settings_tables.sql        → Settings, equipment, vehicles, approvals, documents
├── 00008_add_missing_timestamps.sql → Adds updated_at to 23 tables
├── 00009_add_approved_by.sql        → Adds approved_by to approval_requests
├── 00010_fix_sites_status_check.sql → Adds 'inactive' to sites status
└── 00011_fix_invoice_bill_status_checks.sql → Fixes CHECK constraints
```

Run them in order (00001 first → 00011 last). Each depends on the previous ones.

---

## Step 5: Seed the Database

### Seed the Admin User

```bash
cd backend
npm run seed:admin
```

This creates:
- A Supabase Auth user: `admin@atr.com`
- A profiles row: `ADM-001` with role `admin`

### Seed Demo Data (Optional)

```bash
npm run seed
```

This creates demo data for development/testing:

| Entity | Count | Examples |
|--------|-------|---------|
| Auth users | 4 | admin, office, 2 supervisors |
| Companies | 2 | ATR Construction, Silvergate Infra |
| Sites | 5 | Dum Dum Project, Salt Lake Sector V, etc. |
| Banks | 3 | SBI, HDFC, PNB |
| Payment modes | 3 | NEFT, UPI, Cash |
| Employee categories | 3 | Mason, Helper, Electrician |
| Contractors | 3 | Rajesh Kumar, Sanjay Das, Amit Singh |
| Retailer categories | 2 | Building Materials, Electrical Supplies |
| Retailers | 5 | Bengal Cement House, Eastern Hardware, etc. |
| Stock products | 5 | Cement, TMT Rod, Sand, Bricks, Electric Wire |
| Equipment categories | 2 | Crane, Excavator |
| Head allotments | 4 | Site Expense, Office Expense, etc. |
| Terms & conditions | 2 | Payment Terms, Delivery Terms |
| Vehicles | 2 | Tata 407 Truck, JCB 3DX |

Demo login credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@atr.com | Admin@123 |
| Office | office@atr.com | Office@123 |
| Supervisor 1 | sup1@atr.com | Sup1@123 |
| Supervisor 2 | sup2@atr.com | Sup2@123 |

> The seed script is idempotent — running it multiple times won't create duplicates.

---

## Step 6: Start the Server

```bash
npm run dev
```

You should see:
```
Server running on port 3000
```

### Verify It's Working

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{ "success": true, "data": { "status": "ok", "timestamp": "..." } }
```

### Test Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@atr.com", "password": "Admin@123"}'
```

The response includes a `token`. Use it for all other API calls:
```
Authorization: Bearer <your-token>
```

---

## Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with auto-reload (development) |
| `npm start` | Start server (production) |
| `npm test` | Run test suite |
| `npm run seed:admin` | Create admin user only |
| `npm run seed` | Create all demo data |

---

## Database Schema Overview

The database has **47 tables** organized into these modules:

| Module | Tables | Key Tables |
|--------|--------|------------|
| Auth & Profiles | 2 | `profiles`, `menu_allotments` |
| Core | 4 | `companies`, `sites`, `banks`, `payment_modes` |
| Employees | 7 | `employees`, `employee_categories`, `attendance`, `employee_ledger` |
| Parties | 8 | `contractors`, `supervisors`, `retailers`, `site_orders` |
| Financial | 10 | `payments`, `invoices`, `retailer_bills`, `company_loans` |
| Stock | 5 | `stock_products`, `site_inventory`, `stock_transfers` |
| Settings & Admin | 11 | `approval_requests`, `vehicles`, `documents`, `terms_conditions` |

All tables use:
- `BIGINT GENERATED ALWAYS AS IDENTITY` primary keys
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Monetary values: `NUMERIC(15,2)`

---

## Troubleshooting

### "SUPABASE_URL is required"
Your `.env` file is missing or the variable is not set. Ensure `backend/.env` exists with all required values.

### "relation already exists" during migration
The tables were already created from a previous run. This is safe to ignore — the tables are already in place.

### Seed says "already exists — skipping"
The seed script is idempotent. Data already exists from a previous run. This is normal.

### Server won't start / port in use
Another process is using port 3000. Either stop it or change `PORT` in `.env`:
```env
PORT=3001
```

### "Invalid API key" errors
Double-check that `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` match exactly what's in your Supabase dashboard under Settings → API Keys → Legacy tab.
