/**
 * Company Loan routes
 *
 * GET    /api/loans               — list loans (filter: status)
 * GET    /api/loans/reminders     — active loans with upcoming EMI due (declare BEFORE /:id)
 * GET    /api/loans/:id           — single loan with EMIs
 * POST   /api/loans               — create loan with computed total_payable and monthly_emi
 * PUT    /api/loans/:id           — update loan fields
 * GET    /api/loans/:id/emis      — list EMIs for a loan
 * POST   /api/loans/:id/emis      — add EMI payment record
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication + admin/office role
router.use(authenticateToken);
router.use(requireRole('admin', 'office'));

const LOAN_SELECT = 'id, display_id, loan_id_external, bank, purpose, principal, interest_type, interest_value, tenure, total_payable, monthly_emi, due_date, remind_days, start_date, status, created_at';

// ---------------------------------------------------------------------------
// GET /api/loans/reminders  (MUST be declared BEFORE /:id)
// Active loans where current day of month is within due_date ± remind_days
// AND no EMI record exists for the current month
// ---------------------------------------------------------------------------
router.get('/reminders', async (req, res) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-based

  // Fetch all active loans
  const { data: loans, error: loansError } = await supabase
    .from('company_loans')
    .select(`${LOAN_SELECT}`)
    .eq('status', 'active');

  if (loansError) return sendError(res, loansError.message, 500);

  const reminders = [];

  for (const loan of (loans || [])) {
    const dueDate = Number(loan.due_date);
    const remindDays = Number(loan.remind_days || 5);

    // Check if today is within due_date ± remind_days
    const diff = Math.abs(currentDay - dueDate);
    if (diff > remindDays) continue;

    // Check if an EMI exists for current month/year
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: emis, error: emisError } = await supabase
      .from('company_emis')
      .select('id')
      .eq('loan_id', loan.id)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (emisError) return sendError(res, emisError.message, 500);

    if (!emis || emis.length === 0) {
      reminders.push(loan);
    }
  }

  return sendSuccess(res, reminders);
});

// ---------------------------------------------------------------------------
// GET /api/loans
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { status } = req.query;

  let q = supabase
    .from('company_loans')
    .select(LOAN_SELECT)
    .order('created_at', { ascending: false });

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// GET /api/loans/:id
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid loan ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data: loan, error: loanError } = await supabase
      .from('company_loans')
      .select(LOAN_SELECT)
      .eq('id', id)
      .single();

    if (loanError) return sendError(res, loanError.message, 500);
    if (!loan) return sendError(res, 'Loan not found', 404);

    const { data: emis, error: emisError } = await supabase
      .from('company_emis')
      .select('id, loan_id, date, ref_no, pay_bank, amount, created_at')
      .eq('loan_id', id)
      .order('date', { ascending: false });

    if (emisError) return sendError(res, emisError.message, 500);

    return sendSuccess(res, { ...loan, emis: emis || [] });
  }
);

// ---------------------------------------------------------------------------
// POST /api/loans
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('principal').isNumeric().withMessage('principal must be numeric'),
    body('interest_type').isIn(['%', '₹']).withMessage("interest_type must be '%' or '₹'"),
    body('interest_value').isNumeric().withMessage('interest_value must be numeric'),
    body('tenure').isInt({ min: 1 }).withMessage('tenure must be a positive integer'),
    body('due_date').isInt({ min: 1, max: 31 }).withMessage('due_date must be a day of month (1-31)'),
  ]),
  async (req, res) => {
    const {
      loan_id_external, bank, purpose,
      principal, interest_type, interest_value, tenure,
      due_date, remind_days, start_date, status,
    } = req.body;

    const { count, error: countError } = await supabase
      .from('company_loans')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('LOAN', (count || 0) + 1);

    const principalAmt = parseFloat(Number(principal).toFixed(2));
    const interestVal = parseFloat(Number(interest_value).toFixed(2));
    const tenureInt = parseInt(tenure, 10);

    let total_payable;
    if (interest_type === '%') {
      // total_payable = principal + (principal * interest_value / 100 * tenure / 12)
      total_payable = parseFloat(Number(principalAmt + (principalAmt * interestVal / 100 * tenureInt / 12)).toFixed(2));
    } else {
      // interest_type === '₹'
      // total_payable = principal + (interest_value * tenure)
      total_payable = parseFloat(Number(principalAmt + (interestVal * tenureInt)).toFixed(2));
    }

    const monthly_emi = parseFloat(Number(total_payable / tenureInt).toFixed(2));

    const { data, error } = await supabase
      .from('company_loans')
      .insert({
        display_id,
        loan_id_external: loan_id_external || null,
        bank: bank || null,
        purpose: purpose || null,
        principal: principalAmt,
        interest_type,
        interest_value: interestVal,
        tenure: tenureInt,
        total_payable,
        monthly_emi,
        due_date: parseInt(due_date, 10),
        remind_days: remind_days !== undefined ? parseInt(remind_days, 10) : 5,
        start_date: start_date || null,
        status: status || 'active',
      })
      .select(LOAN_SELECT)
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/loans/:id
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid loan ID')]),
  async (req, res) => {
    const { id } = req.params;

    const allowedFields = [
      'loan_id_external', 'bank', 'purpose', 'due_date',
      'remind_days', 'start_date', 'status',
    ];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('company_loans')
      .update(updates)
      .eq('id', id)
      .select(LOAN_SELECT)
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Loan not found', 404);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// GET /api/loans/:id/emis
// ---------------------------------------------------------------------------
router.get(
  '/:id/emis',
  validate([param('id').isUUID().withMessage('Invalid loan ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('company_emis')
      .select('id, loan_id, date, ref_no, pay_bank, amount, created_at')
      .eq('loan_id', id)
      .order('date', { ascending: false });

    if (error) return sendError(res, error.message, 500);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// POST /api/loans/:id/emis
// ---------------------------------------------------------------------------
router.post(
  '/:id/emis',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid loan ID'),
    body('date').notEmpty().withMessage('date is required'),
    body('amount').isNumeric().withMessage('amount must be numeric'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const { date, ref_no, pay_bank, amount } = req.body;

    const parsedAmount = parseFloat(Number(amount).toFixed(2));

    const { data, error } = await supabase
      .from('company_emis')
      .insert({
        loan_id: id,
        date,
        ref_no: ref_no || null,
        pay_bank: pay_bank || null,
        amount: parsedAmount,
      })
      .select('id, loan_id, date, ref_no, pay_bank, amount, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

module.exports = router;
