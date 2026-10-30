/**
 * Payment routes
 *
 * POST   /api/payments          — create payment (role-based logic)
 * GET    /api/payments          — list payments (filters: category, site_id, status, date range)
 * PUT    /api/payments/:id      — update payment (admin only)
 * DELETE /api/payments/:id      — soft-delete / void payment (admin only)
 * GET    /api/payment-modes     — list available payment modes (all authenticated)
 * POST   /api/payment-modes     — create payment mode (admin only)
 */

const express = require('express');
const { body, query, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { enforceSiteLock } = require('../middleware/sitelock');
const { validate } = require('../middleware/validate');
const { calculateTDS } = require('../services/tdsCalculation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Categories that trigger TDS calculation */
const TDS_CATEGORIES = ['contractor', 'mobilization'];

/** Categories that supervisors are allowed to create */
const SUPERVISOR_ALLOWED_CATEGORIES = ['employee', 'retailer'];

/** All valid payment categories */
const VALID_CATEGORIES = ['employee', 'retailer', 'contractor', 'mobilization', 'office', 'other'];

// ---------------------------------------------------------------------------
// POST /api/payments — create a payment
// ---------------------------------------------------------------------------
router.post(
  '/',
  enforceSiteLock,
  validate([
    body('date').isISO8601().withMessage('date must be a valid ISO date'),
    body('category')
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    body('amount')
      .isFloat({ min: 0 })
      .withMessage('amount must be a non-negative number'),
    body('tdsPercentage')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('tdsPercentage must be between 0 and 100'),
    body('siteId').optional().isUUID().withMessage('siteId must be a valid UUID'),
    body('partyId').optional().isUUID().withMessage('partyId must be a valid UUID'),
    body('paymentModeId').optional().isUUID().withMessage('paymentModeId must be a valid UUID'),
    body('bankId').optional().isUUID().withMessage('bankId must be a valid UUID'),
  ]),
  async (req, res) => {
    const {
      date,
      category,
      partyId,
      partyName,
      partyType,
      siteId,
      amount,
      tdsPercentage = 0,
      paymentModeId,
      bankId,
      remarks,
    } = req.body;

    const role = req.user.role;

    // Role-based category restriction
    if (role === 'supervisor' && !SUPERVISOR_ALLOWED_CATEGORIES.includes(category)) {
      return sendError(res, `Supervisors can only create payments of type: ${SUPERVISOR_ALLOWED_CATEGORIES.join(', ')}`, 403);
    }

    // Role-based status
    let status;
    if (role === 'admin') {
      status = 'cleared';
    } else if (role === 'supervisor') {
      status = 'on_hold';
    } else {
      // office or other authenticated roles → approval flow
      status = 'pending_approval';
    }

    // Supervisors cannot attach a bank account
    const resolvedBankId = role === 'supervisor' ? null : (bankId || null);

    // TDS calculation (only for relevant categories)
    let tdsAmount = 0;
    let netAmount = parseFloat(Number(amount).toFixed(2));
    if (TDS_CATEGORIES.includes(category)) {
      const tds = calculateTDS(Number(amount), Number(tdsPercentage));
      tdsAmount = tds.tdsAmount;
      netAmount = tds.netAmount;
    }

    // Generate display_id: PAY-<seq>
    const { count: payCount } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true });

    const displayId = generateDisplayId('PAY', (payCount || 0) + 1);

    // Insert payment record
    const { data: payment, error: insertError } = await supabase
      .from('payments')
      .insert({
        display_id: displayId,
        date,
        category,
        party_id: partyId || null,
        party_name: partyName || null,
        party_type: partyType || null,
        site_id: siteId || req.user.siteId || null,
        amount: parseFloat(Number(amount).toFixed(2)),
        tds_percentage: parseFloat(Number(tdsPercentage).toFixed(2)),
        tds_amount: tdsAmount,
        net_amount: netAmount,
        payment_mode_id: paymentModeId || null,
        bank_id: resolvedBankId,
        remarks: remarks || null,
        status,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (insertError) return sendError(res, insertError.message, 500);

    // On employee payment with status 'cleared': create employee_ledger Debit entry
    if (category === 'employee' && status === 'cleared' && partyId) {
      const { error: ledgerError } = await supabase
        .from('employee_ledger')
        .insert({
          employee_id: partyId,
          payment_id: payment.id,
          type: 'debit',
          debit_amount: parseFloat(Number(amount).toFixed(2)),
          credit_amount: 0,
          description: `Payment: ${displayId}${remarks ? ' – ' + remarks : ''}`,
          transaction_date: date,
        });

      if (ledgerError) {
        // Ledger failure is fatal: return 500 (consistent with attendance route pattern)
        return sendError(res, `Payment saved but ledger entry failed: ${ledgerError.message}`, 500);
      }
    }

    return sendSuccess(res, payment, 201);
  }
);

// ---------------------------------------------------------------------------
// GET /api/payments — list payments with optional filters
// Supervisor: auto-filtered to own site via enforceSiteLock
// ---------------------------------------------------------------------------
router.get(
  '/',
  enforceSiteLock,
  validate([
    query('category').optional().isIn(VALID_CATEGORIES).withMessage('invalid category'),
    query('site_id').optional().isUUID().withMessage('site_id must be a valid UUID'),
    query('status').optional().isIn(['cleared', 'on_hold', 'pending_approval', 'voided']).withMessage('invalid status'),
    query('from').optional().isISO8601().withMessage('from must be a valid ISO date'),
    query('to').optional().isISO8601().withMessage('to must be a valid ISO date'),
  ]),
  async (req, res) => {
    const { category, site_id, status, from, to } = req.query;

    let q = supabase
      .from('payments')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (category) q = q.eq('category', category);
    if (site_id) q = q.eq('site_id', site_id);
    if (status) q = q.eq('status', status);
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);

    const { data, error } = await q;
    if (error) return sendError(res, error.message, 500);

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/payments/:id — update payment (admin only)
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin'),
  validate([
    param('id').isUUID().withMessage('id must be a valid UUID'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('amount must be non-negative'),
    body('tdsPercentage').optional().isFloat({ min: 0, max: 100 }),
    body('status').optional().isIn(['cleared', 'on_hold', 'pending_approval', 'voided']),
  ]),
  async (req, res) => {
    const { id } = req.params;

    // Build update object with explicit snake_case mapping (never spread req.body directly)
    const updateFields = {};
    if (req.body.date !== undefined)          updateFields.date = req.body.date;
    if (req.body.category !== undefined)      updateFields.category = req.body.category;
    if (req.body.partyId !== undefined)       updateFields.party_id = req.body.partyId;
    if (req.body.partyName !== undefined)     updateFields.party_name = req.body.partyName;
    if (req.body.partyType !== undefined)     updateFields.party_type = req.body.partyType;
    if (req.body.siteId !== undefined)        updateFields.site_id = req.body.siteId;
    if (req.body.paymentModeId !== undefined) updateFields.payment_mode_id = req.body.paymentModeId;
    if (req.body.bankId !== undefined)        updateFields.bank_id = req.body.bankId;
    if (req.body.remarks !== undefined)       updateFields.remarks = req.body.remarks;
    if (req.body.status !== undefined)        updateFields.status = req.body.status;

    // Recalculate TDS when amount or tdsPercentage changes
    if (req.body.amount !== undefined || req.body.tdsPercentage !== undefined) {
      // Fetch current record to fill in whichever value was not supplied
      const { data: current, error: fetchError } = await supabase
        .from('payments')
        .select('amount, tds_percentage, category')
        .eq('id', id)
        .single();

      if (fetchError || !current) {
        return sendError(res, 'Payment not found', 404);
      }

      const grossAmount = req.body.amount !== undefined
        ? parseFloat(Number(req.body.amount).toFixed(2))
        : Number(current.amount);

      const tdsPercentage = req.body.tdsPercentage !== undefined
        ? parseFloat(Number(req.body.tdsPercentage).toFixed(2))
        : Number(current.tds_percentage);

      updateFields.amount = grossAmount;
      updateFields.tds_percentage = tdsPercentage;

      if (TDS_CATEGORIES.includes(current.category)) {
        const tds = calculateTDS(grossAmount, tdsPercentage);
        updateFields.tds_amount = tds.tdsAmount;
        updateFields.net_amount = tds.netAmount;
      }
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) return sendError(res, error.message, 500);
    if (!data) return sendError(res, 'Payment not found', 404);

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/payments/:id — void payment (admin only, soft delete)
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin'),
  validate([
    param('id').isUUID().withMessage('id must be a valid UUID'),
  ]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('payments')
      .update({ status: 'voided' })
      .eq('id', id)
      .select()
      .single();

    if (error) return sendError(res, error.message, 500);
    if (!data) return sendError(res, 'Payment not found', 404);

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// GET /api/payments/generate — generate payroll for a month
// ---------------------------------------------------------------------------
router.get('/generate', requireRole('admin', 'office'), async (req, res) => {
  const { month, site_id } = req.query;
  if (!month) return sendError(res, 'month parameter is required (YYYY-MM)', 400);

  let empQuery = supabase
    .from('employees')
    .select('id, display_id, name, rate, salary_basis, site_id, bank_name, account_no, ifsc')
    .eq('status', 'active');

  if (site_id) empQuery = empQuery.eq('site_id', site_id);

  const { data: employees, error: empErr } = await empQuery;
  if (empErr) return sendError(res, empErr.message, 500);

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  const payroll = [];
  for (const emp of (employees || [])) {
    const { data: att } = await supabase
      .from('attendance')
      .select('status')
      .eq('employee_id', emp.id)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    const daysPresent = (att || []).filter(a => a.status === 'P' || a.status === 'present').length;
    const daysAbsent = daysInMonth - daysPresent;
    const daysLeave = (att || []).filter(a => a.status === 'L' || a.status === 'leave').length;
    const rate = Number(emp.rate || 0);
    const grossPay = emp.salary_basis === 'Monthly' ? rate : rate * daysPresent;

    payroll.push({
      id: emp.id,
      employeeId: emp.id,
      displayId: emp.display_id,
      employee: emp.name,
      site: emp.site_id,
      daysWorked: daysPresent,
      daysAbsent,
      daysLeave,
      rate,
      grossPay,
      deductions: 0,
      finalPayment: grossPay,
      bankName: emp.bank_name,
      accountNo: emp.account_no,
      ifsc: emp.ifsc,
      status: 'pending',
    });
  }

  return sendSuccess(res, payroll);
});

// ---------------------------------------------------------------------------
// POST /api/payments/submit — batch submit employee payments
// ---------------------------------------------------------------------------
router.post('/submit', requireRole('admin', 'office'), async (req, res) => {
  const { month, site_id, payment_date, payments: paymentList } = req.body;
  if (!Array.isArray(paymentList) || !paymentList.length) {
    return sendError(res, 'payments array is required', 400);
  }

  const results = { created: 0, errors: [] };
  for (const p of paymentList) {
    const { count } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true });
    const display_id = generateDisplayId('PAY', (count || 0) + 1);

    const { error } = await supabase.from('payments').insert({
      display_id,
      date: payment_date || new Date().toISOString().slice(0, 10),
      category: 'employee',
      party_type: 'employee',
      party_id: p.employee_id,
      site_id: site_id || null,
      amount: p.final_payment,
      status: 'cleared',
      remarks: `Payroll ${month}`,
      created_by: req.user?.id || null,
    });

    if (error) {
      results.errors.push({ employee_id: p.employee_id, error: error.message });
    } else {
      results.created++;
    }
  }

  return sendSuccess(res, results, 201);
});

// ---------------------------------------------------------------------------
// POST /api/payments/hold — put payments on hold
// ---------------------------------------------------------------------------
router.post('/hold', requireRole('admin', 'office'), async (req, res) => {
  const { payment_ids } = req.body;
  if (!Array.isArray(payment_ids) || !payment_ids.length) {
    return sendError(res, 'payment_ids array is required', 400);
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'on_hold' })
    .in('id', payment_ids)
    .select();

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// Payment Modes sub-router
// ---------------------------------------------------------------------------
const paymentModesRouter = express.Router();

// All payment-modes routes require authentication
paymentModesRouter.use(authenticateToken);

// GET /api/payment-modes — list all (any authenticated user)
paymentModesRouter.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('payment_modes')
    .select('*')
    .order('name', { ascending: true });

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/payment-modes — create (admin only)
paymentModesRouter.post(
  '/',
  requireRole('admin'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('description').optional().isString(),
  ]),
  async (req, res) => {
    const { name, description } = req.body;

    const { data, error } = await supabase
      .from('payment_modes')
      .insert({ name, description: description || null })
      .select()
      .single();

    if (error) return sendError(res, error.message, 500);
    return sendSuccess(res, data, 201);
  }
);

module.exports = { paymentsRouter: router, paymentModesRouter };
