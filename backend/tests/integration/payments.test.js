/**
 * Integration tests for Payment module.
 *
 * Supabase-dependent tests are gated on env vars (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Route guard tests (auth/role checks) always run — they don't need Supabase.
 */

const request = require('supertest');
const { app } = require('../../server');

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const describeSupabase = hasSupabase ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Always-run: auth guards
// ---------------------------------------------------------------------------
describe('Payment routes — auth guards', () => {
  test('GET /api/payments without token returns 401', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/payments without token returns 401', async () => {
    const res = await request(app).post('/api/payments').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/payment-modes without token returns 401', async () => {
    const res = await request(app).get('/api/payment-modes');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/payment-modes without token returns 401', async () => {
    const res = await request(app).post('/api/payment-modes').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests — gated on env vars
// ---------------------------------------------------------------------------
describeSupabase('Payment module — live Supabase', () => {
  let adminToken;
  let supervisorToken;
  let supervisorSiteId;

  const paymentData = {
    date: new Date().toISOString().slice(0, 10),
    category: 'employee',
    partyName: 'Test Worker',
    partyType: 'employee',
    amount: 5000,
    tdsPercentage: 0,
    remarks: 'integration test payment',
  };

  const contractorPaymentData = {
    date: new Date().toISOString().slice(0, 10),
    category: 'contractor',
    partyName: 'Test Contractor',
    partyType: 'contractor',
    amount: 100000,
    tdsPercentage: 2,
    remarks: 'integration test contractor payment',
  };

  beforeAll(async () => {
    if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD });
      adminToken = loginRes.body.data && loginRes.body.data.access_token;
    }

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

  // -------------------------------------------------------------------------
  // Supervisor category restriction
  // -------------------------------------------------------------------------
  test('Supervisor can only create employee and retailer payments', async () => {
    if (!supervisorToken) return;

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ ...paymentData, category: 'contractor' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Supervisor payment saves with status on_hold', async () => {
    if (!supervisorToken) return;

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ ...paymentData, category: 'employee' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('on_hold');
  });

  // -------------------------------------------------------------------------
  // Admin TDS calculation
  // -------------------------------------------------------------------------
  test('Admin payment with TDS deducts correctly', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(contractorPaymentData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // TDS: 2% of 100000 = 2000; net = 98000
    expect(Number(res.body.data.tds_amount)).toBe(2000);
    expect(Number(res.body.data.net_amount)).toBe(98000);
    expect(res.body.data.status).toBe('cleared');
  });

  // -------------------------------------------------------------------------
  // Admin: employee payment → employee_ledger debit entry
  // -------------------------------------------------------------------------
  test('Employee payment (admin, cleared) creates debit in employee_ledger', async () => {
    if (!adminToken) return;

    // Need a real employee ID — skip if TEST_EMPLOYEE_ID not set
    const empId = process.env.TEST_EMPLOYEE_ID;
    if (!empId) return;

    const empPaymentData = {
      date: new Date().toISOString().slice(0, 10),
      category: 'employee',
      partyId: empId,
      partyName: 'Test Employee',
      partyType: 'employee',
      amount: 3000,
      tdsPercentage: 0,
      remarks: 'ledger integration test',
    };

    await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(empPaymentData);

    const ledger = await request(app)
      .get(`/api/employee-ledger/${empId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(ledger.status).toBe(200);
    const debitEntry = ledger.body.data.find(
      (e) => e.type === 'debit' && Number(e.debit_amount) === 3000
    );
    expect(debitEntry).toBeDefined();
    expect(Number(debitEntry.debit_amount)).toBe(empPaymentData.amount);
  });

  // -------------------------------------------------------------------------
  // GET /api/payments filters
  // -------------------------------------------------------------------------
  test('GET /api/payments returns list for admin', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .get('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/payments?category=contractor filters correctly', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .get('/api/payments?category=contractor')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((p) => {
      expect(p.category).toBe('contractor');
    });
  });

  // -------------------------------------------------------------------------
  // Payment modes
  // -------------------------------------------------------------------------
  test('GET /api/payment-modes returns list', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .get('/api/payment-modes')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/payment-modes (admin) creates mode', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .post('/api/payment-modes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Mode Integration', description: 'Integration test payment mode' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Mode Integration');
  });

  test('Supervisor cannot create payment mode (403)', async () => {
    if (!supervisorToken) return;

    const res = await request(app)
      .post('/api/payment-modes')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ name: 'Unauthorized Mode' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // DELETE /api/payments/:id — admin soft delete (void)
  // -------------------------------------------------------------------------
  test('Admin can void a payment', async () => {
    if (!adminToken) return;

    // Create a payment first
    const createRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...paymentData, category: 'other' });

    if (createRes.status !== 201) return;
    const payId = createRes.body.data.id;

    const delRes = await request(app)
      .delete(`/api/payments/${payId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.status).toBe('voided');
  });
});
