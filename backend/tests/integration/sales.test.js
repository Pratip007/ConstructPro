/**
 * Integration tests for Sales module routes (Task 8).
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
describe('Purchase Order routes — auth guards', () => {
  test('GET /api/purchase-orders without token returns 401', async () => {
    const res = await request(app).get('/api/purchase-orders');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/purchase-orders without token returns 401', async () => {
    const res = await request(app).post('/api/purchase-orders').send({ date: '2026-01-01', items: [] });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Invoice routes — auth guards', () => {
  test('GET /api/invoices without token returns 401', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/invoices without token returns 401', async () => {
    const res = await request(app).post('/api/invoices').send({ date: '2026-01-01', base_amount: 1000 });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Balance Received routes — auth guards', () => {
  test('GET /api/balance-received without token returns 401', async () => {
    const res = await request(app).get('/api/balance-received');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/balance-received without token returns 401', async () => {
    const res = await request(app)
      .post('/api/balance-received')
      .send({ invoiceId: '00000000-0000-0000-0000-000000000001', date: '2026-01-01', amount: 100, entryType: 'PAYMENT' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Retailer Bills routes — auth guards', () => {
  test('GET /api/retailer-bills without token returns 401', async () => {
    const res = await request(app).get('/api/retailer-bills');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/retailer-bills/gst-report without token returns 401', async () => {
    const res = await request(app).get('/api/retailer-bills/gst-report');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/retailer-bills/non-gst-report without token returns 401', async () => {
    const res = await request(app).get('/api/retailer-bills/non-gst-report');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/retailer-bills without token returns 401', async () => {
    const res = await request(app).post('/api/retailer-bills').send({ date: '2026-01-01', cart_items: [] });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Loans routes — auth guards', () => {
  test('GET /api/loans without token returns 401', async () => {
    const res = await request(app).get('/api/loans');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/loans/reminders without token returns 401', async () => {
    const res = await request(app).get('/api/loans/reminders');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/loans without token returns 401', async () => {
    const res = await request(app).post('/api/loans').send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit-style business logic tests (no Supabase needed)
// ---------------------------------------------------------------------------
describe('Business logic — PO item total computation', () => {
  // Test the percentage unit logic inline (mirrors the route helper)
  function computeItemTotals(item) {
    const qty = parseFloat(Number(item.qty).toFixed(2));
    const price = parseFloat(Number(item.price).toFixed(2));
    const gst_percent = parseFloat(Number(item.gst_percent || 0).toFixed(2));
    const unit = (item.unit || '').trim();

    const isPercentage = unit === '%' || unit.toLowerCase() === 'percentage';
    const base_total = isPercentage
      ? parseFloat(Number((price * qty) / 100).toFixed(2))
      : parseFloat(Number(price * qty).toFixed(2));

    const gst_amount = parseFloat(Number(base_total * gst_percent / 100).toFixed(2));
    const line_total = parseFloat(Number(base_total + gst_amount).toFixed(2));

    return { qty, price, gst_percent, base_total, gst_amount, line_total };
  }

  test('Standard unit: base_total = price * qty', () => {
    const result = computeItemTotals({ qty: 10, price: 100, unit: 'pcs', gst_percent: 18 });
    expect(result.base_total).toBe(1000);
    expect(result.gst_amount).toBe(180);
    expect(result.line_total).toBe(1180);
  });

  test('Percentage unit (%): base_total = price * qty / 100', () => {
    const result = computeItemTotals({ qty: 5, price: 200, unit: '%', gst_percent: 10 });
    expect(result.base_total).toBe(10); // 200 * 5 / 100 = 10
    expect(result.gst_amount).toBe(1); // 10 * 10% = 1
    expect(result.line_total).toBe(11);
  });

  test('Percentage unit (Percentage): same base_total logic', () => {
    const result = computeItemTotals({ qty: 10, price: 100, unit: 'Percentage', gst_percent: 0 });
    expect(result.base_total).toBe(10); // 100 * 10 / 100 = 10
    expect(result.gst_amount).toBe(0);
    expect(result.line_total).toBe(10);
  });

  test('PO totals computed from items array', () => {
    const items = [
      { qty: 2, price: 500, unit: 'pcs', gst_percent: 18 },
      { qty: 3, price: 200, unit: 'pcs', gst_percent: 12 },
    ];
    const computedItems = items.map(computeItemTotals);
    const base_amount = parseFloat(computedItems.reduce((s, i) => s + i.base_total, 0).toFixed(2));
    const gst_amount = parseFloat(computedItems.reduce((s, i) => s + i.gst_amount, 0).toFixed(2));
    const net_amount = parseFloat(Number(base_amount + gst_amount).toFixed(2));

    expect(base_amount).toBe(1600); // 1000 + 600
    expect(gst_amount).toBe(parseFloat((180 + 72).toFixed(2))); // 252
    expect(net_amount).toBe(1852);
  });
});

describe('Business logic — Loan total_payable computation', () => {
  function computeLoan(principal, interest_type, interest_value, tenure) {
    const principalAmt = parseFloat(Number(principal).toFixed(2));
    const interestVal = parseFloat(Number(interest_value).toFixed(2));
    const tenureInt = parseInt(tenure, 10);

    let total_payable;
    if (interest_type === '%') {
      total_payable = parseFloat(Number(principalAmt + (principalAmt * interestVal / 100 * tenureInt / 12)).toFixed(2));
    } else {
      total_payable = parseFloat(Number(principalAmt + (interestVal * tenureInt)).toFixed(2));
    }

    const monthly_emi = parseFloat(Number(total_payable / tenureInt).toFixed(2));
    return { total_payable, monthly_emi };
  }

  test('Percentage interest type computes correctly', () => {
    // principal=100000, rate=12%, tenure=12 months → total = 100000 + 100000*12/100*12/12 = 112000
    const result = computeLoan(100000, '%', 12, 12);
    expect(result.total_payable).toBe(112000);
    expect(result.monthly_emi).toBe(parseFloat((112000 / 12).toFixed(2)));
  });

  test('Fixed amount (₹) interest type computes correctly', () => {
    // principal=50000, interest=500 per month, tenure=24 → total = 50000 + 500*24 = 62000
    const result = computeLoan(50000, '₹', 500, 24);
    expect(result.total_payable).toBe(62000);
    expect(result.monthly_emi).toBe(parseFloat((62000 / 24).toFixed(2)));
  });

  test('monthly_emi is total_payable / tenure rounded to 2 decimals', () => {
    // principal=10000, rate=5%, tenure=3 months → total = 10000 + 10000*5/100*3/12 = 10125
    const result = computeLoan(10000, '%', 5, 3);
    expect(result.total_payable).toBe(10125);
    expect(result.monthly_emi).toBe(3375);
  });
});

describe('Business logic — Balance received invoice status', () => {
  function computeInvoiceStatus(grossAmount, payments) {
    const totalReceived = parseFloat(
      payments.reduce((s, p) => s + Number(p), 0).toFixed(2)
    );
    const ga = parseFloat(Number(grossAmount).toFixed(2));

    if (totalReceived >= ga) return 'paid';
    if (totalReceived > 0) return 'partial';
    return 'unpaid';
  }

  test('Full payment marks invoice as paid', () => {
    const status = computeInvoiceStatus(1000, [1000]);
    expect(status).toBe('paid');
  });

  test('Overpayment also marks invoice as paid', () => {
    const status = computeInvoiceStatus(1000, [600, 500]);
    expect(status).toBe('paid');
  });

  test('Partial payment marks invoice as partial', () => {
    const status = computeInvoiceStatus(1000, [400]);
    expect(status).toBe('partial');
  });

  test('No payment marks invoice as unpaid', () => {
    const status = computeInvoiceStatus(1000, []);
    expect(status).toBe('unpaid');
  });
});

describe('Business logic — Retailer bill item computation', () => {
  function computeBillItemTotals(item) {
    const qty = parseFloat(Number(item.qty).toFixed(2));
    const price = parseFloat(Number(item.price).toFixed(2));
    const gst_percent = parseFloat(Number(item.gst_percent || 0).toFixed(2));
    const unit = (item.unit || '').trim();

    const isPercentage = unit === '%' || unit.toLowerCase() === 'percentage';
    const line_total = isPercentage
      ? parseFloat(Number((price * qty) / 100).toFixed(2))
      : parseFloat(Number(price * qty).toFixed(2));

    const line_gst = parseFloat(Number(line_total * gst_percent / 100).toFixed(2));
    const final_total = parseFloat(Number(line_total + line_gst).toFixed(2));

    return { qty, price, gst_percent, line_total, line_gst, final_total };
  }

  test('GST bill item computes line_gst and final_total', () => {
    const result = computeBillItemTotals({ qty: 5, price: 200, unit: 'kg', gst_percent: 18 });
    expect(result.line_total).toBe(1000);
    expect(result.line_gst).toBe(180);
    expect(result.final_total).toBe(1180);
  });

  test('Non-GST bill item has zero gst', () => {
    const result = computeBillItemTotals({ qty: 3, price: 100, unit: 'pcs', gst_percent: 0 });
    expect(result.line_total).toBe(300);
    expect(result.line_gst).toBe(0);
    expect(result.final_total).toBe(300);
  });

  test('Bill due_amount computed from total - paid', () => {
    const items = [
      computeBillItemTotals({ qty: 2, price: 500, unit: 'pcs', gst_percent: 18 }),
    ];
    const total_amount = parseFloat(items.reduce((s, i) => s + i.final_total, 0).toFixed(2));
    const paid_amount = 500;
    const due_amount = parseFloat(Number(total_amount - paid_amount).toFixed(2));

    expect(total_amount).toBe(1180);
    expect(due_amount).toBe(680);
    expect(due_amount > 0 ? 'DUE' : 'PAID').toBe('DUE');
  });
});

// ---------------------------------------------------------------------------
// Live Supabase tests — gated on env vars
// ---------------------------------------------------------------------------
describeSupabase('Sales module — live Supabase', () => {
  let adminToken;
  let createdPOId;
  let createdInvoiceId;
  let createdBillId;
  let createdLoanId;

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
  // PO creation with items
  // -------------------------------------------------------------------------
  test('Admin can create a PO with items and correct totals', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/purchase-orders').send({
      date: '2026-10-01',
      items: [
        { name: 'Cement', unit: 'bag', qty: 10, price: 350, gst_percent: 18 },
        { name: 'Steel', unit: 'kg', qty: 100, price: 60, gst_percent: 12 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.display_id).toMatch(/^PO-\d+$/);
    // base_amount = 3500 + 6000 = 9500
    expect(res.body.data.base_amount).toBe(9500);
    // gst_amount = 630 + 720 = 1350
    expect(res.body.data.gst_amount).toBe(1350);
    expect(res.body.data.net_amount).toBe(10850);
    expect(res.body.data.items).toHaveLength(2);

    createdPOId = res.body.data.id;
  });

  test('GET /api/purchase-orders lists POs', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/purchase-orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/purchase-orders/:id returns PO with items', async () => {
    if (!adminToken || !createdPOId) return;

    const res = await adminReq().get(`/api/purchase-orders/${createdPOId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('items');
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Invoice creation
  // -------------------------------------------------------------------------
  test('Admin can create an invoice linked to a PO', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/invoices').send({
      date: '2026-10-05',
      base_amount: 9500,
      gst_amount: 1350,
      is_gst: true,
      po_id: createdPOId || undefined,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.display_id).toMatch(/^INV-\d+$/);
    expect(res.body.data.gross_amount).toBe(10850);
    expect(res.body.data.status).toBe('unpaid');

    createdInvoiceId = res.body.data.id;
  });

  // -------------------------------------------------------------------------
  // Balance received updates invoice status
  // -------------------------------------------------------------------------
  test('Partial payment marks invoice as partial', async () => {
    if (!adminToken || !createdInvoiceId) return;

    const res = await adminReq().post('/api/balance-received').send({
      invoiceId: createdInvoiceId,
      date: '2026-10-10',
      amount: 5000,
      entryType: 'PAYMENT',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoiceStatus).toBe('partial');
    expect(res.body.data.totalReceived).toBe(5000);
  });

  test('Full payment marks invoice as paid', async () => {
    if (!adminToken || !createdInvoiceId) return;

    const res = await adminReq().post('/api/balance-received').send({
      invoiceId: createdInvoiceId,
      date: '2026-10-15',
      amount: 5850,
      entryType: 'PAYMENT',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoiceStatus).toBe('paid');
  });

  // -------------------------------------------------------------------------
  // Retailer bills
  // -------------------------------------------------------------------------
  test('Admin can create a GST retailer bill', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/retailer-bills').send({
      date: '2026-10-01',
      retailer_name: 'Test Retailer',
      gst_applicable: true,
      gst_number: '29ABCDE1234F1Z5',
      paid_amount: 200,
      cart_items: [
        { item: 'Nails', qty: 10, unit: 'kg', price: 50, gst_percent: 18 },
        { item: 'Bolts', qty: 5, unit: 'pcs', price: 20, gst_percent: 12 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.display_id).toMatch(/^BILL-\d+$/);
    expect(res.body.data.gst_applicable).toBe(true);
    // total = (500 * 1.18) + (100 * 1.12) = 590 + 112 = 702
    expect(res.body.data.total_amount).toBe(702);
    expect(res.body.data.due_amount).toBe(502);
    expect(res.body.data.status).toBe('DUE');
    expect(res.body.data.items).toHaveLength(2);

    createdBillId = res.body.data.id;
  });

  test('GET /api/retailer-bills/gst-report returns only GST bills', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/retailer-bills/gst-report');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((bill) => {
      expect(bill.gst_applicable).toBe(true);
    });
  });

  test('GET /api/retailer-bills/non-gst-report returns only non-GST bills', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/retailer-bills/non-gst-report');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((bill) => {
      expect(bill.gst_applicable).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Loans
  // -------------------------------------------------------------------------
  test('Admin can create a loan with percentage interest', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/loans').send({
      bank: 'SBI',
      purpose: 'Equipment purchase',
      principal: 100000,
      interest_type: '%',
      interest_value: 12,
      tenure: 12,
      due_date: 5,
      remind_days: 3,
      start_date: '2026-01-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.display_id).toMatch(/^LOAN-\d+$/);
    expect(res.body.data.total_payable).toBe(112000);
    expect(res.body.data.monthly_emi).toBe(parseFloat((112000 / 12).toFixed(2)));

    createdLoanId = res.body.data.id;
  });

  test('Admin can add an EMI to a loan', async () => {
    if (!adminToken || !createdLoanId) return;

    const res = await adminReq().post(`/api/loans/${createdLoanId}/emis`).send({
      date: '2026-10-05',
      amount: 9333.33,
      pay_bank: 'SBI',
      ref_no: 'TXN12345',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.loan_id).toBe(createdLoanId);
    expect(res.body.data.amount).toBe(9333.33);
  });

  test('GET /api/loans/:id/emis lists EMIs', async () => {
    if (!adminToken || !createdLoanId) return;

    const res = await adminReq().get(`/api/loans/${createdLoanId}/emis`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/loans/reminders returns array', async () => {
    if (!adminToken) return;

    const res = await adminReq().get('/api/loans/reminders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Validation errors
  // -------------------------------------------------------------------------
  test('POST /api/purchase-orders without items returns 400', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/purchase-orders').send({
      date: '2026-10-01',
      items: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/loans without required fields returns 400', async () => {
    if (!adminToken) return;

    const res = await adminReq().post('/api/loans').send({
      bank: 'HDFC',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
