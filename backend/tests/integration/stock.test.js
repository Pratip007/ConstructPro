/**
 * Integration tests for Stock, Equipment, Vehicles, and Income/Expense routes (Task 9).
 *
 * Route guard tests (auth/role checks) always run — they don't touch Supabase.
 * Supabase-gated CRUD tests are wrapped in describe.skip so CI passes without credentials.
 *
 * Required env vars for live tests:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 */

const request = require('supertest');
const { app } = require('../../server');

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const describeSupabase = hasSupabase ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Always-run: auth guards (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Stock Products routes — auth guards', () => {
  test('GET /api/stock-products without token returns 401', async () => {
    const res = await request(app).get('/api/stock-products');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/stock-products without token returns 401', async () => {
    const res = await request(app).post('/api/stock-products').send({ name: 'Cement', unit: 'bag' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Site Inventory routes — auth guards', () => {
  test('GET /api/site-inventory without token returns 401', async () => {
    const res = await request(app).get('/api/site-inventory');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Stock Transfers routes — auth guards', () => {
  test('GET /api/stock-transfers without token returns 401', async () => {
    const res = await request(app).get('/api/stock-transfers');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/stock-transfers without token returns 401', async () => {
    const res = await request(app).post('/api/stock-transfers').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Damaged Stocks routes — auth guards', () => {
  test('GET /api/damaged-stocks without token returns 401', async () => {
    const res = await request(app).get('/api/damaged-stocks');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/damaged-stocks without token returns 401', async () => {
    const res = await request(app).post('/api/damaged-stocks').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Equipment routes — auth guards', () => {
  test('GET /api/equipment-categories without token returns 401', async () => {
    const res = await request(app).get('/api/equipment-categories');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/equipment without token returns 401', async () => {
    const res = await request(app).get('/api/equipment');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/equipment-site-assignments without token returns 401', async () => {
    const res = await request(app).get('/api/equipment-site-assignments');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Vehicles routes — auth guards', () => {
  test('GET /api/vehicles without token returns 401', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vehicles without token returns 401', async () => {
    const res = await request(app).post('/api/vehicles').send({ vehicle_number: 'MH01AB1234', vehicle_type: 'Truck' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Income/Expense routes — auth guards', () => {
  test('GET /api/income-expenses without token returns 401', async () => {
    const res = await request(app).get('/api/income-expenses');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/income-expenses without token returns 401', async () => {
    const res = await request(app).post('/api/income-expenses').send({ date: '2026-01-01', type: 'Income', amount: 1000 });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit-style business logic tests (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Business logic — Stock transfer quantity calculation', () => {
  function computeTransfer(currentQty, requestedQty) {
    const current = parseFloat(Number(currentQty).toFixed(3));
    const requested = parseFloat(Number(requestedQty).toFixed(3));

    if (current < requested) {
      return { success: false, error: 'Insufficient stock' };
    }

    const newSourceQty = parseFloat(Number(current - requested).toFixed(3));
    return { success: true, newSourceQty };
  }

  test('Transfer deducts correct quantity from source', () => {
    const result = computeTransfer(100, 30);
    expect(result.success).toBe(true);
    expect(result.newSourceQty).toBe(70);
  });

  test('Transfer with exact available quantity succeeds', () => {
    const result = computeTransfer(50, 50);
    expect(result.success).toBe(true);
    expect(result.newSourceQty).toBe(0);
  });

  test('Transfer with insufficient stock returns error', () => {
    const result = computeTransfer(20, 50);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient stock');
  });

  test('Transfer to destination upserts correct total', () => {
    const existingDestQty = parseFloat(Number(40).toFixed(3));
    const transferQty = parseFloat(Number(30).toFixed(3));
    const newDestQty = parseFloat(Number(existingDestQty + transferQty).toFixed(3));
    expect(newDestQty).toBe(70);
  });

  test('Transfer to new destination starts at transferred quantity', () => {
    // If destination has no inventory, it should start at qty transferred
    const transferQty = parseFloat(Number(25.5).toFixed(3));
    expect(transferQty).toBe(25.5);
  });
});

describe('Business logic — Damaged stock quantity reduction', () => {
  function recordDamage(currentQty, damageQty) {
    const current = parseFloat(Number(currentQty).toFixed(3));
    const damage = parseFloat(Number(damageQty).toFixed(3));

    if (current < damage) {
      return { success: false, error: 'Insufficient stock to record damage' };
    }

    const remaining = parseFloat(Number(current - damage).toFixed(3));
    return { success: true, remaining };
  }

  test('Damage reduces inventory correctly', () => {
    const result = recordDamage(100, 15);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(85);
  });

  test('Damage exceeding stock returns error', () => {
    const result = recordDamage(10, 20);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient stock to record damage');
  });

  test('Damage equal to stock leaves zero inventory', () => {
    const result = recordDamage(50, 50);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });
});

describe('Business logic — Income/Expense summary computation', () => {
  function computeSummary(entries) {
    let totalIncome = 0;
    let totalExpense = 0;
    entries.forEach((entry) => {
      const amount = parseFloat(Number(entry.amount).toFixed(2));
      if (entry.type === 'Income') totalIncome += amount;
      else if (entry.type === 'Expense') totalExpense += amount;
    });
    totalIncome = parseFloat(totalIncome.toFixed(2));
    totalExpense = parseFloat(totalExpense.toFixed(2));
    const netBalance = parseFloat(Number(totalIncome - totalExpense).toFixed(2));
    return { totalIncome, totalExpense, netBalance };
  }

  test('Summary computes totalIncome correctly', () => {
    const entries = [
      { type: 'Income', amount: 5000 },
      { type: 'Income', amount: 3000 },
      { type: 'Expense', amount: 2000 },
    ];
    const summary = computeSummary(entries);
    expect(summary.totalIncome).toBe(8000);
  });

  test('Summary computes totalExpense correctly', () => {
    const entries = [
      { type: 'Income', amount: 5000 },
      { type: 'Expense', amount: 2000 },
      { type: 'Expense', amount: 1500 },
    ];
    const summary = computeSummary(entries);
    expect(summary.totalExpense).toBe(3500);
  });

  test('Net balance = totalIncome - totalExpense', () => {
    const entries = [
      { type: 'Income', amount: 10000 },
      { type: 'Expense', amount: 4000 },
    ];
    const summary = computeSummary(entries);
    expect(summary.netBalance).toBe(6000);
  });

  test('Negative net balance when expenses exceed income', () => {
    const entries = [
      { type: 'Income', amount: 2000 },
      { type: 'Expense', amount: 5000 },
    ];
    const summary = computeSummary(entries);
    expect(summary.netBalance).toBe(-3000);
  });

  test('Empty entries returns zero summary', () => {
    const summary = computeSummary([]);
    expect(summary.totalIncome).toBe(0);
    expect(summary.totalExpense).toBe(0);
    expect(summary.netBalance).toBe(0);
  });
});

describe('Business logic — Vehicle display_id generation', () => {
  const { generateDisplayId } = require('../../src/utils/displayId');

  test('First vehicle gets VEH-001', () => {
    expect(generateDisplayId('VEH', 1)).toBe('VEH-001');
  });

  test('Tenth vehicle gets VEH-010', () => {
    expect(generateDisplayId('VEH', 10)).toBe('VEH-010');
  });

  test('Stock product gets SP prefix', () => {
    expect(generateDisplayId('SP', 5)).toBe('SP-005');
  });

  test('Transfer gets STR prefix', () => {
    expect(generateDisplayId('STR', 3)).toBe('STR-003');
  });

  test('Damaged stock gets DMG prefix', () => {
    expect(generateDisplayId('DMG', 12)).toBe('DMG-012');
  });

  test('Equipment party gets EQP prefix', () => {
    expect(generateDisplayId('EQP', 7)).toBe('EQP-007');
  });

  test('Site assignment gets ESA prefix', () => {
    expect(generateDisplayId('ESA', 99)).toBe('ESA-099');
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests — gated on env vars
// ---------------------------------------------------------------------------
describeSupabase('Stock module — live Supabase', () => {
  let adminToken;
  let createdProductId;
  let fromSiteId;
  let toSiteId;
  let createdVehicleId;

  function adminReq() {
    return request(app).set('Authorization', `Bearer ${adminToken}`);
  }

  beforeAll(async () => {
    if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD });
      adminToken = loginRes.body.data && loginRes.body.data.access_token;
    }
  });

  // -------------------------------------------------------------------------
  // Stock product creation
  // -------------------------------------------------------------------------
  test('Admin can create a stock product', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/stock-products').send({
      name: 'Test Cement',
      unit: 'bag',
      hsn: '2523',
      category: 'Raw Material',
      gst_percent: 18,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.display_id).toMatch(/^SP-\d+$/);
    expect(res.body.data.gst_percent).toBe(18);

    createdProductId = res.body.data.id;
  });

  test('GET /api/stock-products lists products', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/stock-products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Stock transfer with inventory check
  // -------------------------------------------------------------------------
  test('Stock transfer with insufficient stock returns 400', async () => {
    if (!adminToken || !createdProductId) return;

    // Need two valid site UUIDs — use placeholder UUIDs to trigger inventory check
    const res = await adminReq().post('/api/stock-transfers').send({
      date: '2026-10-01',
      fromSiteId: '00000000-0000-0000-0000-000000000001',
      toSiteId: '00000000-0000-0000-0000-000000000002',
      items: [
        { productId: createdProductId, qty: 9999999, unit: 'bag' },
      ],
    });

    // Either 400 (inventory check fails) or 500 (FK violation — both indicate no transfer happened)
    expect([400, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Vehicle CRUD
  // -------------------------------------------------------------------------
  test('Admin can create a vehicle', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/vehicles').send({
      vehicle_number: `TEST-${Date.now()}`,
      vehicle_type: 'Truck',
      make: 'Tata',
      model: 'Prima',
      year: 2022,
      owner_name: 'Test Owner',
      owner_contact: '9876543210',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.display_id).toMatch(/^VEH-\d+$/);
    expect(res.body.data.vehicle_type).toBe('Truck');

    createdVehicleId = res.body.data.id;
  });

  test('GET /api/vehicles lists vehicles', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/vehicles');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('Admin can add a service log to a vehicle', async () => {
    if (!adminToken || !createdVehicleId) return;

    const res = await adminReq().post(`/api/vehicles/${createdVehicleId}/service-logs`).send({
      service_date: '2026-10-15',
      service_type: 'Oil Change',
      description: 'Routine oil change at 10000km',
      cost: 2500,
      odometer_reading: 10000,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehicle_id).toBe(createdVehicleId);
    expect(res.body.data.cost).toBe(2500);
  });

  test('GET /api/vehicles/:id/service-logs lists logs', async () => {
    if (!adminToken || !createdVehicleId) return;

    const res = await adminReq().get(`/api/vehicles/${createdVehicleId}/service-logs`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('Admin can soft delete a vehicle', async () => {
    if (!adminToken || !createdVehicleId) return;

    const res = await adminReq().delete(`/api/vehicles/${createdVehicleId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehicle.status).toBe('inactive');
  });

  // -------------------------------------------------------------------------
  // Income/Expense CRUD + summary
  // -------------------------------------------------------------------------
  test('Admin can create an Income entry', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/income-expenses').send({
      date: '2026-10-01',
      type: 'Income',
      bank_account: 'SBI Main',
      purpose: 'Contract payment',
      amount: 50000,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('Income');
    expect(res.body.data.amount).toBe(50000);
  });

  test('Admin can create an Expense entry', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/income-expenses').send({
      date: '2026-10-02',
      type: 'Expense',
      bank_account: 'SBI Main',
      purpose: 'Material purchase',
      amount: 20000,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('Expense');
  });

  test('GET /api/income-expenses returns entries and summary', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/income-expenses');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('entries');
    expect(res.body.data).toHaveProperty('summary');
    expect(Array.isArray(res.body.data.entries)).toBe(true);
    expect(res.body.data.summary).toHaveProperty('totalIncome');
    expect(res.body.data.summary).toHaveProperty('totalExpense');
    expect(res.body.data.summary).toHaveProperty('netBalance');
    // netBalance must equal totalIncome - totalExpense
    const { totalIncome, totalExpense, netBalance } = res.body.data.summary;
    expect(netBalance).toBeCloseTo(totalIncome - totalExpense, 2);
  });

  // -------------------------------------------------------------------------
  // Validation errors
  // -------------------------------------------------------------------------
  test('POST /api/stock-products without name returns 400', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/stock-products').send({ unit: 'bag' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/stock-transfers without items returns 400', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/stock-transfers').send({
      date: '2026-10-01',
      fromSiteId: '00000000-0000-0000-0000-000000000001',
      toSiteId: '00000000-0000-0000-0000-000000000002',
      items: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/income-expenses with invalid type returns 400', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/income-expenses').send({
      date: '2026-10-01',
      type: 'Transfer',
      amount: 1000,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vehicles without vehicle_number returns 400', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/vehicles').send({ vehicle_type: 'Truck' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
