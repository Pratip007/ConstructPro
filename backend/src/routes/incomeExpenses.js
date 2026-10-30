/**
 * Income/Expense routes
 *
 * GET    /    — list entries with computed summary { totalIncome, totalExpense, netBalance }.
 *              Filter by type, purpose, date range (from, to).
 * POST   /    — create entry. Admin/office.
 * PUT    /:id — update entry. Admin only.
 * DELETE /:id — soft delete (status → 'inactive'). Admin only.
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('admin', 'office'));

// ---------------------------------------------------------------------------
// GET /api/income-expenses
// Returns entries + summary { totalIncome, totalExpense, netBalance }
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { type, purpose, from, to, bank_account, from_date, to_date } = req.query;

  let q = supabase
    .from('income_expenses')
    .select('id, date, type, bank_account, purpose, particulars, remark, amount, status, created_at')
    .neq('status', 'inactive')
    .order('date', { ascending: false });

  if (type) q = q.eq('type', type);
  if (purpose) q = q.eq('purpose', purpose);
  if (bank_account) q = q.eq('bank_account', bank_account);
  if (from || from_date) q = q.gte('date', from || from_date);
  if (to || to_date) q = q.lte('date', to || to_date);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);

  // Compute summary
  let totalIncome = 0;
  let totalExpense = 0;
  (data || []).forEach((entry) => {
    const amount = parseFloat(Number(entry.amount).toFixed(2));
    if (entry.type === 'Income') totalIncome += amount;
    else if (entry.type === 'Expense') totalExpense += amount;
  });
  totalIncome = parseFloat(totalIncome.toFixed(2));
  totalExpense = parseFloat(totalExpense.toFixed(2));
  const netBalance = parseFloat(Number(totalIncome - totalExpense).toFixed(2));

  return sendSuccess(res, {
    entries: data || [],
    summary: { totalIncome, totalExpense, netBalance },
  });
});

// ---------------------------------------------------------------------------
// POST /api/income-expenses
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('date').notEmpty().withMessage('date is required'),
    body('type').isIn(['Income', 'Expense']).withMessage('type must be Income or Expense'),
    body('amount').isNumeric().withMessage('amount must be numeric'),
  ]),
  async (req, res) => {
    const { date, type, bank_account, purpose, particulars, remark, amount } = req.body;

    const { data, error } = await supabase
      .from('income_expenses')
      .insert({
        date,
        type,
        bank_account: bank_account || null,
        purpose: purpose || null,
        particulars: particulars || null,
        remark: remark || null,
        amount: parseFloat(Number(amount).toFixed(2)),
        status: 'active',
      })
      .select('id, date, type, bank_account, purpose, particulars, remark, amount, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/income-expenses/:id
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid income/expense ID')]),
  async (req, res) => {
    const { id } = req.params;
    const allowedFields = ['date', 'type', 'bank_account', 'purpose', 'particulars', 'remark', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    // Handle amount separately for precision rounding
    if (req.body.amount !== undefined) {
      updates.amount = parseFloat(Number(req.body.amount).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('income_expenses')
      .update(updates)
      .eq('id', id)
      .select('id, date, type, bank_account, purpose, particulars, remark, amount, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Income/expense entry not found', 404);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/income-expenses/:id
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid income/expense ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('income_expenses')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Income/expense entry not found', 404);
    return sendSuccess(res, { message: 'Entry deactivated', entry: data });
  }
);

module.exports = router;
