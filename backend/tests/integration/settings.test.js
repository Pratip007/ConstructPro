/**
 * Integration tests for Settings, Documents, and Backup routes (Task 10).
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

// ===========================================================================
// Always-run: auth guards (no Supabase needed)
// ===========================================================================

describe('Settings routes — auth guards', () => {
  // Terms
  test('GET /api/settings/terms without token returns 401', async () => {
    const res = await request(app).get('/api/settings/terms');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/settings/terms without token returns 401', async () => {
    const res = await request(app).post('/api/settings/terms').send({ title: 'T', content: 'C' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/settings/terms/:id without token returns 401', async () => {
    const res = await request(app)
      .put('/api/settings/terms/00000000-0000-0000-0000-000000000000')
      .send({ title: 'New' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('DELETE /api/settings/terms/:id without token returns 401', async () => {
    const res = await request(app).delete('/api/settings/terms/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // Heads
  test('GET /api/settings/heads without token returns 401', async () => {
    const res = await request(app).get('/api/settings/heads');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/settings/heads without token returns 401', async () => {
    const res = await request(app)
      .post('/api/settings/heads')
      .send({ name: 'Materials', type: 'Expense' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // Menus
  test('GET /api/settings/menus/:profileId without token returns 401', async () => {
    const res = await request(app).get('/api/settings/menus/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/settings/menus/:profileId without token returns 401', async () => {
    const res = await request(app)
      .put('/api/settings/menus/00000000-0000-0000-0000-000000000000')
      .send({ menuItems: [] });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Document routes — auth guards', () => {
  test('GET /api/document-folders without token returns 401', async () => {
    const res = await request(app).get('/api/document-folders');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/document-folders without token returns 401', async () => {
    const res = await request(app).post('/api/document-folders').send({ name: 'Folder' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/documents without token returns 401', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/documents without token returns 401', async () => {
    const res = await request(app).post('/api/documents').send({ name: 'Doc' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/documents/:id/download without token returns 401', async () => {
    const res = await request(app).get('/api/documents/00000000-0000-0000-0000-000000000000/download');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Backup routes — auth guards', () => {
  test('POST /api/backup/export without token returns 401', async () => {
    const res = await request(app).post('/api/backup/export');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/backup/import without token returns 401', async () => {
    const res = await request(app).post('/api/backup/import').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================================================
// Live Supabase tests — gated on env vars
// ===========================================================================
describeSupabase('Settings module — live Supabase', () => {
  let adminToken;
  let officeToken;

  function adminReq() {
    return request(app).set('Authorization', `Bearer ${adminToken}`);
  }
  function officeReq() {
    return request(app).set('Authorization', `Bearer ${officeToken}`);
  }

  beforeAll(async () => {
    if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD });
      adminToken = loginRes.body.data && loginRes.body.data.access_token;
    }

    if (process.env.TEST_OFFICE_EMAIL && process.env.TEST_OFFICE_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.TEST_OFFICE_EMAIL, password: process.env.TEST_OFFICE_PASSWORD });
      officeToken = loginRes.body.data && loginRes.body.data.access_token;
    }
  });

  // -------------------------------------------------------------------------
  // Terms & Conditions CRUD
  // -------------------------------------------------------------------------
  describe('Terms & Conditions', () => {
    let createdTermsId;

    test('Admin can create terms & conditions', async () => {
      if (!adminToken) return;

      const res = await adminReq().post('/api/settings/terms').send({
        title: 'Test T&C',
        content: 'These are the terms.',
        module: 'Payment',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('Test T&C');
      expect(res.body.data.status).toBe('active');

      createdTermsId = res.body.data.id;
    });

    test('Admin can list terms & conditions', async () => {
      if (!adminToken) return;

      const res = await adminReq().get('/api/settings/terms');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('GET /api/settings/terms?module=Payment filters by module', async () => {
      if (!adminToken) return;

      const res = await adminReq().get('/api/settings/terms?module=Payment');
      expect(res.status).toBe(200);
      res.body.data.forEach((t) => {
        expect(t.module).toBe('Payment');
      });
    });

    test('Admin can update terms & conditions', async () => {
      if (!adminToken || !createdTermsId) return;

      const res = await adminReq()
        .put(`/api/settings/terms/${createdTermsId}`)
        .send({ title: 'Updated T&C' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated T&C');
    });

    test('PUT terms with no valid fields returns 400', async () => {
      if (!adminToken) return;

      const res = await adminReq()
        .put('/api/settings/terms/00000000-0000-0000-0000-000000000001')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('POST terms without required fields returns 400', async () => {
      if (!adminToken) return;

      const res = await adminReq().post('/api/settings/terms').send({ module: 'X' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('Office user submits approval request for terms', async () => {
      if (!officeToken) return;

      const res = await officeReq().post('/api/settings/terms').send({
        title: 'Office T&C',
        content: 'Content here.',
      });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Approval request submitted');
      expect(res.body.data.approval).toHaveProperty('id');
    });

    test('Admin can soft-delete terms & conditions', async () => {
      if (!adminToken || !createdTermsId) return;

      const res = await adminReq().delete(`/api/settings/terms/${createdTermsId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.terms.status).toBe('inactive');
    });
  });

  // -------------------------------------------------------------------------
  // Head Allotments CRUD
  // -------------------------------------------------------------------------
  describe('Head Allotments', () => {
    let createdHeadId;

    test('Admin can create a head allotment', async () => {
      if (!adminToken) return;

      const res = await adminReq().post('/api/settings/heads').send({
        name: 'Test Material Cost',
        type: 'Expense',
        description: 'Raw materials',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.type).toBe('Expense');
      expect(res.body.data.status).toBe('active');

      createdHeadId = res.body.data.id;
    });

    test('Admin can list head allotments', async () => {
      if (!adminToken) return;

      const res = await adminReq().get('/api/settings/heads');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('GET /api/settings/heads?type=Expense filters by type', async () => {
      if (!adminToken) return;

      const res = await adminReq().get('/api/settings/heads?type=Expense');
      expect(res.status).toBe(200);
      res.body.data.forEach((h) => {
        expect(h.type).toBe('Expense');
      });
    });

    test('POST head with invalid type returns 400', async () => {
      if (!adminToken) return;

      const res = await adminReq().post('/api/settings/heads').send({
        name: 'Invalid',
        type: 'Revenue',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('Admin can update a head allotment', async () => {
      if (!adminToken || !createdHeadId) return;

      const res = await adminReq()
        .put(`/api/settings/heads/${createdHeadId}`)
        .send({ description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated description');
    });

    test('Admin can soft-delete a head allotment', async () => {
      if (!adminToken || !createdHeadId) return;

      const res = await adminReq().delete(`/api/settings/heads/${createdHeadId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.head.status).toBe('inactive');
    });

    test('Office user gets 403 on POST /api/settings/heads', async () => {
      if (!officeToken) return;

      const res = await officeReq().post('/api/settings/heads').send({
        name: 'Office Head',
        type: 'Income',
      });

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Menu Allotments — replace
  // -------------------------------------------------------------------------
  describe('Menu Allotments', () => {
    let testProfileId;

    beforeAll(async () => {
      if (!adminToken) return;
      // Fetch an existing profile to use
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await sb.from('profiles').select('id').limit(1).single();
      testProfileId = data && data.id;
    });

    test('Admin can replace menu allotments for a profile', async () => {
      if (!adminToken || !testProfileId) return;

      const res = await adminReq()
        .put(`/api/settings/menus/${testProfileId}`)
        .send({
          menuItems: [
            { menuItemId: 'menu-dashboard', menuName: 'Dashboard', menuUrl: '/dashboard', granted: true },
            { menuItemId: 'menu-reports', menuName: 'Reports', menuUrl: '/reports', granted: false },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(2);
    });

    test('Admin can clear menu allotments by sending empty array', async () => {
      if (!adminToken || !testProfileId) return;

      const res = await adminReq()
        .put(`/api/settings/menus/${testProfileId}`)
        .send({ menuItems: [] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Menu allotments cleared');
    });

    test('Admin can list menu allotments for a profile', async () => {
      if (!adminToken || !testProfileId) return;

      const res = await adminReq().get(`/api/settings/menus/${testProfileId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('PUT menus without menuItems array returns 400', async () => {
      if (!adminToken || !testProfileId) return;

      const res = await adminReq()
        .put(`/api/settings/menus/${testProfileId}`)
        .send({ menuItems: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Backup export
  // -------------------------------------------------------------------------
  describe('Backup', () => {
    test('Backup export returns valid JSON structure', async () => {
      if (!adminToken) return;

      const res = await adminReq().post('/api/backup/export');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data).toHaveProperty('_meta');
      expect(data._meta).toHaveProperty('exported_at');
      expect(data._meta).toHaveProperty('tables');
      expect(Array.isArray(data._meta.tables)).toBe(true);

      // All major tables should be present
      const expectedTables = ['companies', 'banks', 'sites', 'employees'];
      expectedTables.forEach((t) => {
        expect(data).toHaveProperty(t);
        expect(Array.isArray(data[t])).toBe(true);
      });
    });

    test('POST /api/backup/import with unknown table keys returns 400', async () => {
      if (!adminToken) return;

      const res = await adminReq().post('/api/backup/import').send({
        unknown_table: [{ id: '1' }],
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/backup/import with non-array table value returns 400', async () => {
      if (!adminToken) return;

      const res = await adminReq().post('/api/backup/import').send({
        companies: 'not-an-array',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

// Storage-dependent tests (require live Supabase Storage)
describe.skip('Documents — Supabase Storage integration', () => {
  test('Admin can upload a document (base64)', async () => {
    // Requires live Supabase with Storage bucket 'documents' configured
  });

  test('Admin can get signed download URL for a document', async () => {
    // Requires live Supabase with Storage
  });

  test('Admin can delete a document (removes from Storage + soft-deletes DB)', async () => {
    // Requires live Supabase with Storage
  });
});
