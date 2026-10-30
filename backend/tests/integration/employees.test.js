/**
 * Integration tests for Employee module.
 *
 * Supabase-dependent tests are gated on env vars.
 * Route guard tests (no Supabase needed) always run.
 */

const request = require('supertest');
const { app } = require('../../server');

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const describeSupabase = hasSupabase ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Always-run tests — route guard checks only (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Employee routes — auth guards', () => {
  test('GET /api/employees without token returns 401', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/employees without token returns 401', async () => {
    const res = await request(app).post('/api/employees').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('DELETE /api/employees/:id without token returns 401', async () => {
    const res = await request(app).delete('/api/employees/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/employee-categories without token returns 401', async () => {
    const res = await request(app).get('/api/employee-categories');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/site-tagging without token returns 401', async () => {
    const res = await request(app).get('/api/site-tagging');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests
// ---------------------------------------------------------------------------
describeSupabase('Employee module — live Supabase', () => {
  let adminToken;
  let supervisorToken;
  let supervisorSiteId;
  let createdEmpId;

  beforeAll(async () => {
    // Get admin token
    if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD });
      adminToken = loginRes.body.data && loginRes.body.data.access_token;
    }

    // Get supervisor token and site
    if (process.env.TEST_SUPERVISOR_EMAIL && process.env.TEST_SUPERVISOR_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.TEST_SUPERVISOR_EMAIL, password: process.env.TEST_SUPERVISOR_PASSWORD });
      if (loginRes.body.data) {
        supervisorToken = loginRes.body.data.access_token;
        supervisorSiteId = loginRes.body.data.user && loginRes.body.data.user.site_id;
      }
    }
  });

  test('Create employee auto-generates display_id in EMP-XXX format', async () => {
    if (!adminToken) return;

    const employeeData = {
      name: 'Test Employee Integration',
      salary_basis: 'Per Day',
      base_daily_wage: 800,
      aadhaar: '123456789012',
    };

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(employeeData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.display_id).toMatch(/^EMP-\d+$/);
    expect(res.body.data).not.toHaveProperty('aadhaar_hash');

    createdEmpId = res.body.data.id;
  });

  test('GET /api/employees returns list without aadhaar_hash', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((emp) => {
      expect(emp).not.toHaveProperty('aadhaar_hash');
    });
  });

  test('Supervisor can only list employees from own site', async () => {
    if (!supervisorToken || !supervisorSiteId) return;

    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${supervisorToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((emp) => {
      expect(emp.current_site_id).toBe(supervisorSiteId);
    });
  });

  test('Supervisor accessing different site via query param returns 403', async () => {
    if (!supervisorToken) return;

    const res = await request(app)
      .get('/api/employees?site_id=00000000-0000-0000-0000-000000000999')
      .set('Authorization', `Bearer ${supervisorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/employees/:id soft-updates employee (admin)', async () => {
    if (!adminToken || !createdEmpId) return;

    const res = await request(app)
      .put(`/api/employees/${createdEmpId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ designation: 'Senior Worker' });

    expect(res.status).toBe(200);
    expect(res.body.data.designation).toBe('Senior Worker');
  });

  test('DELETE /api/employees/:id soft-deletes (status=inactive)', async () => {
    if (!adminToken || !createdEmpId) return;

    const res = await request(app)
      .delete(`/api/employees/${createdEmpId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.employee.status).toBe('inactive');
  });
});
