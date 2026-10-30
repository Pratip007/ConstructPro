/**
 * Integration tests for Approval Engine (Task 6).
 *
 * Supabase-dependent tests are gated on env vars (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Route guard tests (auth/role checks) always run — they don't touch Supabase.
 *
 * Required env vars for live tests:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *   TEST_OFFICE_EMAIL, TEST_OFFICE_PASSWORD
 *   TEST_EMP_ID      — BIGINT employee id for attendance approval test
 *   TEST_SUB_ID      — BIGINT employee_sub_id for attendance approval test
 *   TEST_SITE_ID     — BIGINT site id for attendance approval test
 */

const request = require('supertest');
const { app } = require('../../server');

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const describeSupabase = hasSupabase ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Always-run: auth guards (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Approval routes — auth guards', () => {
  test('POST /api/approvals without token returns 401', async () => {
    const res = await request(app).post('/api/approvals').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/approvals without token returns 401', async () => {
    const res = await request(app).get('/api/approvals');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/approvals/pending-counts without token returns 401', async () => {
    const res = await request(app).get('/api/approvals/pending-counts');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/approvals/1/approve without token returns 401', async () => {
    const res = await request(app).put('/api/approvals/1/approve').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/approvals/1/reject without token returns 401', async () => {
    const res = await request(app).put('/api/approvals/1/reject').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests — gated on env vars
// ---------------------------------------------------------------------------
describeSupabase('Approval module — live Supabase', () => {
  let adminToken;
  let officeToken;

  // IDs for attendance approval test
  const empId = process.env.TEST_EMP_ID;
  const subId = process.env.TEST_SUB_ID;
  const siteId = process.env.TEST_SITE_ID;

  // Base approval data — uses module 'Other' so no side effects are triggered on approve
  const approvalData = {
    source: 'office',
    module: 'Other',
    action_type: 'new_entry',
    reason: 'Integration test approval',
    new_data: { test: true },
  };

  // Helper: make an authenticated supertest agent for office role
  function adminReq() {
    return request(app).set('Authorization', `Bearer ${adminToken}`);
  }
  function officeReq() {
    return request(app).set('Authorization', `Bearer ${officeToken}`);
  }

  beforeAll(async () => {
    // Login as admin
    if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD });
      adminToken = loginRes.body.data && loginRes.body.data.access_token;
    }

    // Login as office user
    if (process.env.TEST_OFFICE_EMAIL && process.env.TEST_OFFICE_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.TEST_OFFICE_EMAIL, password: process.env.TEST_OFFICE_PASSWORD });
      officeToken = loginRes.body.data && loginRes.body.data.access_token;
    }
  });

  // -------------------------------------------------------------------------
  // Submit approval request
  // -------------------------------------------------------------------------
  test('Office user can submit approval request', async () => {
    if (!officeToken) return;

    const res = await officeReq().post('/api/approvals').send(approvalData);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.module).toBe('Other');
  });

  test('Supervisor cannot access pending-counts (403)', async () => {
    // pending-counts is admin-only; office/supervisor get 403
    if (!officeToken) return;

    const res = await officeReq().get('/api/approvals/pending-counts');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Approve a request
  // -------------------------------------------------------------------------
  test('Admin can approve pending request', async () => {
    if (!adminToken || !officeToken) return;

    // Create a fresh request to approve
    const createRes = await officeReq().post('/api/approvals').send(approvalData);
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.data.id;

    const res = await adminReq().put(`/api/approvals/${reqId}/approve`).send({ remarks: 'OK' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('approved');
  });

  // -------------------------------------------------------------------------
  // Reject without remarks → 400
  // -------------------------------------------------------------------------
  test('Rejection without remarks returns 400', async () => {
    if (!adminToken || !officeToken) return;

    const createRes = await officeReq().post('/api/approvals').send(approvalData);
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.data.id;

    const res = await adminReq().put(`/api/approvals/${reqId}/reject`).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Double-approve same request → 409 (concurrent approval guard)
  // -------------------------------------------------------------------------
  test('Double-approve same request returns 409', async () => {
    if (!adminToken || !officeToken) return;

    const createRes = await officeReq().post('/api/approvals').send(approvalData);
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.data.id;

    // First approve — should succeed
    const first = await adminReq().put(`/api/approvals/${reqId}/approve`).send({ remarks: 'OK' });
    expect(first.status).toBe(200);

    // Second approve of same (now 'approved') request — must return 409
    const second = await adminReq().put(`/api/approvals/${reqId}/approve`).send({ remarks: 'Again' });
    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Attendance approval creates credit in employee_ledger
  // -------------------------------------------------------------------------
  test('Attendance approval creates credit in employee ledger', async () => {
    if (!adminToken || !officeToken || !empId || !subId || !siteId) return;

    const attendancePayload = {
      employeeId: parseInt(empId, 10),
      subId: parseInt(subId, 10),
      siteId: parseInt(siteId, 10),
      month: '2026-10',
      presentDays: 26,
      otHours: 0,
      salaryBasis: 'Per Day',
      baseDailyWage: 800,
    };

    const createRes = await officeReq().post('/api/approvals').send({
      ...approvalData,
      module: 'Attendance',
      new_data: attendancePayload,
    });
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.data.id;

    const approveRes = await adminReq()
      .put(`/api/approvals/${reqId}/approve`)
      .send({ remarks: 'OK' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // Verify employee_ledger has a credit entry
    const ledger = await adminReq().get(`/api/employee-ledger/${empId}`);
    expect(ledger.status).toBe(200);
    expect(Array.isArray(ledger.body.data)).toBe(true);
    expect(ledger.body.data.some((e) => e.type === 'credit')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Pending counts
  // -------------------------------------------------------------------------
  test('Pending counts returns correct shape', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/approvals/pending-counts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('office');
    expect(res.body.data).toHaveProperty('supervisor');
    expect(res.body.data).toHaveProperty('loans');
    expect(typeof res.body.data.office).toBe('number');
    expect(typeof res.body.data.supervisor).toBe('number');
  });

  // -------------------------------------------------------------------------
  // GET /api/approvals — list
  // -------------------------------------------------------------------------
  test('GET /api/approvals returns list for admin', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/approvals');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/approvals?status=pending filters correctly', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/approvals?status=pending');
    expect(res.status).toBe(200);
    res.body.data.forEach((r) => {
      expect(r.status).toBe('pending');
    });
  });

  // -------------------------------------------------------------------------
  // Admin reject with remarks → 200
  // -------------------------------------------------------------------------
  test('Admin can reject pending request with remarks', async () => {
    if (!adminToken || !officeToken) return;

    const createRes = await officeReq().post('/api/approvals').send(approvalData);
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.data.id;

    const res = await adminReq()
      .put(`/api/approvals/${reqId}/reject`)
      .send({ remarks: 'Not needed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.admin_remarks).toBe('Not needed');
  });
});
