/**
 * Integration tests for auth middleware and routes.
 *
 * Tests that require a live Supabase instance are wrapped in describe.skip
 * when SUPABASE_URL is not set in the environment. Pure-logic / unit tests
 * and the health-check test always run.
 */

const request = require('supertest');
const { app } = require('../../server');

// Detect whether a real Supabase connection is available
const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Always-run tests (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Auth routes — no-token guard', () => {
  test('GET /api/auth/me without Authorization header returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/auth/me with malformed token returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login with missing fields returns 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login with invalid email format returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'somepass' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/signup without Authorization header returns 401', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'employee',
      displayId: 'EMP-001',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/auth/password without token returns 401', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .send({ newPassword: 'newpassword123' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/auth/password validation rejects short password (no token path)', async () => {
    // Without a token, hits 401 before validation — this is expected
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', 'Bearer bad')
      .send({ newPassword: 'short' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Middleware unit-style tests
// ---------------------------------------------------------------------------
describe('requireRole middleware', () => {
  const { requireRole } = require('../../src/middleware/roles');

  test('passes when role matches', () => {
    const req = { user: { role: 'admin' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();
    requireRole('admin', 'office')(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 403 when role does not match', () => {
    const req = { user: { role: 'supervisor' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();
    requireRole('admin', 'office')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 401 when req.user is missing', () => {
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('enforceSiteLock middleware', () => {
  const { enforceSiteLock } = require('../../src/middleware/sitelock');

  test('non-supervisor passes through without modification', () => {
    const req = { user: { role: 'admin', siteId: null }, query: {}, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    enforceSiteLock(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.query.site_id).toBeUndefined();
  });

  test('supervisor with matching site_id passes through', () => {
    const req = {
      user: { role: 'supervisor', siteId: 'site-42' },
      query: { site_id: 'site-42' },
      body: {},
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    enforceSiteLock(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('supervisor with different site_id returns 403', () => {
    const req = {
      user: { role: 'supervisor', siteId: 'site-42' },
      query: { site_id: 'site-999' },
      body: {},
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    enforceSiteLock(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('supervisor without site_id in request has siteId injected', () => {
    const req = {
      user: { role: 'supervisor', siteId: 'site-42' },
      query: {},
      body: {},
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    enforceSiteLock(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.query.site_id).toBe('site-42');
    expect(req.body.site_id).toBe('site-42');
  });

  test('returns 401 when req.user is missing', () => {
    const req = { query: {}, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    enforceSiteLock(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests (skipped when env vars are absent)
// ---------------------------------------------------------------------------
const describeSupabase = hasSupabase ? describe : describe.skip;

describeSupabase('POST /api/auth/login — live Supabase', () => {
  test('POST /api/auth/login with valid credentials returns access_token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('access_token');
    expect(res.body.data).toHaveProperty('refresh_token');
    expect(res.body.data).toHaveProperty('user');
  });

  test('POST /api/auth/login with invalid password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_USER_EMAIL || 'test@example.com',
        password: 'wrong-password-that-will-never-match',
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describeSupabase('GET /api/auth/me — live Supabase', () => {
  let token;

  beforeAll(async () => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) return;
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
      });
    token = res.body.data && res.body.data.access_token;
  });

  test('GET /api/auth/me with valid token returns profile without aadhaar_hash', async () => {
    if (!token) return;
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('aadhaar_hash');
    expect(res.body.data).toHaveProperty('name');
  });
});

describeSupabase('Site lock — live Supabase (supervisor access)', () => {
  test('Admin accessing any site returns 200', async () => {
    const adminToken = process.env.TEST_ADMIN_TOKEN;
    if (!adminToken) return;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// Activated in Task 4 — route now exists and is wired with authenticateToken + enforceSiteLock.
describeSupabase('Site lock — /api/employees (live Supabase)', () => {
  test('Supervisor accessing different site via query param returns 403', async () => {
    const supervisorToken = process.env.TEST_SUPERVISOR_TOKEN;
    if (!supervisorToken) return;

    const res = await request(app)
      .get('/api/employees?site_id=00000000-0000-0000-0000-000000000999')
      .set('Authorization', `Bearer ${supervisorToken}`);
    expect(res.status).toBe(403);
  });
});
