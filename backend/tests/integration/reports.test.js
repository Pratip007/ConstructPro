'use strict';

/**
 * Integration tests for Reports + Dashboard KPIs (Task 11).
 *
 * Route guard tests (auth/role checks) always run — they don't touch Supabase.
 * Supabase-gated tests are wrapped in describe.skip so CI passes without credentials.
 *
 * Required env vars for live tests:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *   TEST_EMP_ID     — UUID of an employee with at least one ledger entry
 *   TEST_SITE_ID    — UUID of a site
 */

const request = require('supertest');
const { app } = require('../../server');

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const describeSupabase = hasSupabase ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Always-run: auth guards (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Report/Dashboard routes — auth guards', () => {
  // --- Dashboard ---
  test('GET /api/dashboard/kpis without token returns 401', async () => {
    const res = await request(app).get('/api/dashboard/kpis');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/dashboard/pending-dues without token returns 401', async () => {
    const res = await request(app).get('/api/dashboard/pending-dues');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/dashboard/notifications without token returns 401', async () => {
    const res = await request(app).get('/api/dashboard/notifications');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // --- Reports ---
  test('GET /api/reports/site-ledger without token returns 401', async () => {
    const res = await request(app).get('/api/reports/site-ledger?site_id=1');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/reports/mobilization without token returns 401', async () => {
    const res = await request(app).get('/api/reports/mobilization');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/reports/sales without token returns 401', async () => {
    const res = await request(app).get('/api/reports/sales');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // --- Ledgers ---
  test('GET /api/ledger/employee/:uuid without token returns 401', async () => {
    const res = await request(app).get('/api/ledger/employee/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/ledger/contractor/:uuid without token returns 401', async () => {
    const res = await request(app).get('/api/ledger/contractor/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/ledger/retailer/:uuid without token returns 401', async () => {
    const res = await request(app).get('/api/ledger/retailer/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/ledger/supervisor/:uuid without token returns 401', async () => {
    const res = await request(app).get('/api/ledger/supervisor/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/ledger/company/:uuid without token returns 401', async () => {
    const res = await request(app).get('/api/ledger/company/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // --- sales report requires valid fy format ---
  test('GET /api/reports/sales?fy=invalid without token returns 401 (auth checked first)', async () => {
    const res = await request(app).get('/api/reports/sales?fy=ABCD');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests — gated on env vars
// ---------------------------------------------------------------------------
describeSupabase('Reports module — live Supabase', () => {
  let adminToken;

  function adminReq() {
    return request(app).set('Authorization', `Bearer ${adminToken}`);
  }

  beforeAll(async () => {
    if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.TEST_ADMIN_EMAIL,
          password: process.env.TEST_ADMIN_PASSWORD,
        });
      adminToken = loginRes.body.data && loginRes.body.data.access_token;
    }
  });

  // -------------------------------------------------------------------------
  // Dashboard KPIs
  // -------------------------------------------------------------------------
  test('Dashboard KPIs returns expected structure with correct types', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/dashboard/kpis');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const d = res.body.data;
    expect(d).toHaveProperty('activeSites');
    expect(d).toHaveProperty('activeEmployees');
    expect(d).toHaveProperty('contractors');
    expect(d).toHaveProperty('supervisors');
    expect(d).toHaveProperty('retailers');
    expect(d).toHaveProperty('totalBankBalance');
    expect(typeof d.activeSites).toBe('number');
    expect(typeof d.totalBankBalance).toBe('number');
  });

  // -------------------------------------------------------------------------
  // Notification counts
  // -------------------------------------------------------------------------
  test('Notification counts returns numbers for office, supervisor, total', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/dashboard/notifications');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const d = res.body.data;
    expect(d).toHaveProperty('office');
    expect(d).toHaveProperty('supervisor');
    expect(d).toHaveProperty('total');
    expect(typeof d.office).toBe('number');
    expect(typeof d.supervisor).toBe('number');
    expect(typeof d.total).toBe('number');
    expect(d.total).toBe(d.office + d.supervisor);
  });

  // -------------------------------------------------------------------------
  // Pending dues
  // -------------------------------------------------------------------------
  test('Pending dues returns arrays for employees, retailers, contractors', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/dashboard/pending-dues');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const d = res.body.data;
    expect(Array.isArray(d.employees)).toBe(true);
    expect(Array.isArray(d.retailers)).toBe(true);
    expect(Array.isArray(d.contractors)).toBe(true);

    // All employee balances should be positive
    d.employees.forEach((e) => {
      expect(e.balance).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Employee ledger — running balance
  // -------------------------------------------------------------------------
  test('Employee ledger has running balance field on each entry', async () => {
    if (!adminToken || !process.env.TEST_EMP_ID) return;

    const empId = process.env.TEST_EMP_ID;
    const res = await adminReq().get(`/api/ledger/employee/${empId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    if (res.body.data.length > 0) {
      const entry = res.body.data[0];
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('particulars');
      expect(entry).toHaveProperty('debit');
      expect(entry).toHaveProperty('credit');
      expect(entry).toHaveProperty('balance');
      expect(typeof entry.debit).toBe('number');
      expect(typeof entry.credit).toBe('number');
      expect(typeof entry.balance).toBe('number');
    }
  });

  // -------------------------------------------------------------------------
  // Site ledger — 4 sections
  // -------------------------------------------------------------------------
  test('Site ledger returns 4 sections and grandTotal', async () => {
    if (!adminToken || !process.env.TEST_SITE_ID) return;

    const siteId = process.env.TEST_SITE_ID;
    const res = await adminReq().get(`/api/reports/site-ledger?site_id=${siteId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const d = res.body.data;
    expect(d).toHaveProperty('sections');
    expect(d).toHaveProperty('grandTotal');
    expect(d.sections).toHaveProperty('employee');
    expect(d.sections).toHaveProperty('mobilization');
    expect(d.sections).toHaveProperty('retailer');
    expect(d.sections).toHaveProperty('contractor');
    expect(Array.isArray(d.sections.employee)).toBe(true);
    expect(typeof d.grandTotal.total).toBe('number');
  });

  // -------------------------------------------------------------------------
  // Sales report
  // -------------------------------------------------------------------------
  test('Sales report returns monthly breakdown and grandTotal', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/reports/sales?fy=2026');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const d = res.body.data;
    expect(Array.isArray(d.monthly)).toBe(true);
    expect(d).toHaveProperty('grandTotal');
    expect(typeof d.grandTotal.gross).toBe('number');
  });

  // -------------------------------------------------------------------------
  // Mobilization report
  // -------------------------------------------------------------------------
  test('Mobilization report returns array with enriched fields', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/reports/mobilization');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
