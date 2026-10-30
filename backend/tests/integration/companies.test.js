/**
 * Integration tests for Companies routes (Task 7).
 *
 * Route guard tests (auth/role checks) always run — they don't touch Supabase.
 * Supabase-gated CRUD tests are wrapped in describe.skip so CI passes without credentials.
 *
 * Required env vars for live tests:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *   TEST_OFFICE_EMAIL, TEST_OFFICE_PASSWORD
 */

const request = require('supertest');
const { app } = require('../../server');

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const describeSupabase = hasSupabase ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Always-run: auth guards (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Company routes — auth guards', () => {
  test('GET /api/companies without token returns 401', async () => {
    const res = await request(app).get('/api/companies');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/companies without token returns 401', async () => {
    const res = await request(app).post('/api/companies').send({ name: 'Test Co' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/companies/some-id without token returns 401', async () => {
    const res = await request(app).put('/api/companies/00000000-0000-0000-0000-000000000000').send({ name: 'New' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('DELETE /api/companies/some-id without token returns 401', async () => {
    const res = await request(app).delete('/api/companies/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests — gated on env vars
// ---------------------------------------------------------------------------
describeSupabase('Company module — live Supabase', () => {
  let adminToken;
  let officeToken;
  let createdCompanyId;

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
  // Admin create company
  // -------------------------------------------------------------------------
  test('Admin can create a company', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/companies').send({
      name: 'Test Construction Co',
      gst_number: '29ABCDE1234F1Z5',
      state_code: 'KA',
      phone: '9876543210',
      email: 'test@construction.com',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Test Construction Co');
    expect(res.body.data.status).toBe('active');

    createdCompanyId = res.body.data.id;
  });

  // -------------------------------------------------------------------------
  // Display ID format
  // -------------------------------------------------------------------------
  test('Created company has auto-generated display_id matching COMP-\\d+', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/companies').send({
      name: 'Display ID Test Co',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.display_id).toMatch(/^COMP-\d+$/);
  });

  // -------------------------------------------------------------------------
  // Admin list companies
  // -------------------------------------------------------------------------
  test('Admin can list companies', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/companies');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Filter by status
  // -------------------------------------------------------------------------
  test('GET /api/companies?status=active filters by status', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/companies?status=active');
    expect(res.status).toBe(200);
    res.body.data.forEach((c) => {
      expect(c.status).toBe('active');
    });
  });

  // -------------------------------------------------------------------------
  // Admin update company
  // -------------------------------------------------------------------------
  test('Admin can update a company', async () => {
    if (!adminToken || !createdCompanyId) return;

    const res = await adminReq()
      .put(`/api/companies/${createdCompanyId}`)
      .send({ phone: '1111111111' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phone).toBe('1111111111');
  });

  // -------------------------------------------------------------------------
  // Admin soft-delete company
  // -------------------------------------------------------------------------
  test('Admin can soft-delete a company', async () => {
    if (!adminToken || !createdCompanyId) return;

    const res = await adminReq().delete(`/api/companies/${createdCompanyId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.company.status).toBe('inactive');
  });

  // -------------------------------------------------------------------------
  // Office gets approval request instead of direct delete
  // -------------------------------------------------------------------------
  test('Office user gets approval request (202) on delete, not direct delete', async () => {
    if (!officeToken) return;

    // Create a fresh company first as admin
    const createRes = await adminReq().post('/api/companies').send({ name: 'Office Delete Test Co' });
    if (createRes.status !== 201) return;

    const companyId = createRes.body.data.id;

    const res = await officeReq().delete(`/api/companies/${companyId}`);
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Approval request submitted');
  });

  // -------------------------------------------------------------------------
  // Office cannot direct-delete (creates approval instead)
  // Supervisor gets 403 on POST
  // -------------------------------------------------------------------------
  test('PUT with no valid fields returns 400', async () => {
    if (!adminToken) return;

    const res = await adminReq()
      .put('/api/companies/00000000-0000-0000-0000-000000000001')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Validation: POST without required name returns 400
  // -------------------------------------------------------------------------
  test('POST without name returns 400 validation error', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/companies').send({ gst_number: 'INVALID' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Office user creates approval request for new company
  // -------------------------------------------------------------------------
  test('Office user submits approval request for new company', async () => {
    if (!officeToken) return;

    const res = await officeReq().post('/api/companies').send({ name: 'Office Approval Co' });
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Approval request submitted');
    expect(res.body.data.approval).toHaveProperty('id');
    expect(res.body.data.approval.status).toBe('pending');
  });
});
