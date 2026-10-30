/**
 * Integration tests for Attendance module + OT calculation.
 *
 * Supabase-dependent tests are gated on env vars.
 * Route guard tests (no Supabase needed) always run.
 */

const request = require('supertest');
const { app } = require('../../server');

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const describeSupabase = hasSupabase ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Always-run tests — route guards only (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Attendance routes — auth guards', () => {
  test('GET /api/attendance without token returns 401', async () => {
    const res = await request(app).get('/api/attendance');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/attendance without token returns 401', async () => {
    const res = await request(app).post('/api/attendance').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/employee-ledger/:id without token returns 401', async () => {
    const res = await request(app).get('/api/employee-ledger/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/site-leaves without token returns 401', async () => {
    const res = await request(app).get('/api/site-leaves');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OT calculation unit-style tests (pure logic, always run)
// ---------------------------------------------------------------------------
describe('OT Calculation — via service module', () => {
  const { calculateOT } = require('../../src/services/otCalculation');

  test('Per Day: 800/day × 5 days + 4 OT hrs → total 4400', () => {
    const r = calculateOT('Per Day', 800, 5, 4);
    expect(r.presentWage).toBe(4000);
    expect(r.otRatePerHr).toBe(100);
    expect(r.otAmount).toBe(400);
    expect(r.totalAmount).toBe(4400);
  });

  test('Monthly: OT is always 0 regardless of hours', () => {
    const r = calculateOT('Monthly', 500, 26, 10);
    expect(r.otAmount).toBe(0);
    expect(r.totalAmount).toBe(13000);
  });

  test('Per Day: 0 OT hours → otAmount is 0, not NaN', () => {
    const r = calculateOT('Per Day', 800, 5, 0);
    expect(r.otAmount).toBe(0);
    expect(Number.isNaN(r.otAmount)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests
// ---------------------------------------------------------------------------
describeSupabase('Attendance module — live Supabase', () => {
  let adminToken;
  let empId;
  let subId;
  let siteId;

  beforeAll(async () => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) return;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD });
    adminToken = loginRes.body.data && loginRes.body.data.access_token;

    // Use test IDs from env if provided
    empId = process.env.TEST_EMP_ID;
    subId = process.env.TEST_SUB_ID;
    siteId = process.env.TEST_SITE_ID;
  });

  test('Employee ledger shows credit after attendance creation', async () => {
    if (!adminToken || !empId || !subId || !siteId) return;

    const attendanceData = {
      employeeId: empId,
      subId,
      siteId,
      month: '2026-10',
      presentDays: 26,
      otHours: 0,
    };

    // POST attendance
    const attRes = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(attendanceData);

    expect(attRes.status).toBe(201);
    expect(attRes.body.data).toHaveProperty('total_amount');
    expect(attRes.body.data.total_amount).toBeGreaterThan(0);

    // Check ledger
    const ledgerRes = await request(app)
      .get(`/api/employee-ledger/${empId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(ledgerRes.status).toBe(200);
    expect(Array.isArray(ledgerRes.body.data)).toBe(true);
    const credits = ledgerRes.body.data.filter((e) => e.type === 'credit');
    expect(credits.length).toBeGreaterThan(0);
    expect(credits[0].credit_amount).toBeGreaterThan(0);
  });

  test('POST /api/attendance with missing fields returns 400', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: empId }); // missing required fields

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/site-leaves returns list', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .get('/api/site-leaves')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
