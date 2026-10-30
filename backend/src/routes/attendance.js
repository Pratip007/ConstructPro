const express = require('express');
const { body, query } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { calculateOT } = require('../services/otCalculation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { enforceSiteLock } = require('../middleware/sitelock');
const { validate } = require('../middleware/validate');
const { createApprovalRequest } = require('../services/approvalEngine');

const router = express.Router();

router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/attendance
// Filters: employee_id, site_id, month (YYYY-MM)
// Supervisor: auto-filtered to own site via enforceSiteLock.
// ---------------------------------------------------------------------------
router.get(
  '/',
  enforceSiteLock,
  validate([
    query('employee_id').optional().isUUID().withMessage('employee_id must be a valid UUID'),
    query('site_id').optional().isUUID().withMessage('site_id must be a valid UUID'),
    query('month')
      .optional()
      .matches(/^\d{4}-\d{2}$/)
      .withMessage('month must be in YYYY-MM format'),
  ]),
  async (req, res) => {
    const { employee_id, site_id, month } = req.query;

    let q = supabase
      .from('attendance')
      .select(`
        id, employee_id, sub_id, site_id, month, present_days, ot_hours,
        present_wage, ot_rate_per_hr, ot_amount, total_amount,
        created_at, updated_at
      `)
      .order('month', { ascending: false });

    if (employee_id) q = q.eq('employee_id', employee_id);
    if (site_id) q = q.eq('site_id', site_id);
    if (month) q = q.like('month', `${month}%`);

    const { data, error } = await q;
    if (error) return sendError(res, error.message, 500);

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// POST /api/attendance
// Body: { employeeId, subId, siteId, month, presentDays, otHours }
// Looks up sub-ID for rate & salary_basis, computes OT.
// Admin: saves directly + creates employee_ledger Credit.
// Supervisor: creates approval request.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'supervisor'),
  enforceSiteLock,
  validate([
    body('employeeId').isUUID().withMessage('employeeId must be a valid UUID'),
    body('subId').isUUID().withMessage('subId must be a valid UUID'),
    body('siteId').isUUID().withMessage('siteId must be a valid UUID'),
    body('month')
      .matches(/^\d{4}-\d{2}$/)
      .withMessage('month must be in YYYY-MM format'),
    body('presentDays').isInt({ min: 0, max: 31 }).withMessage('presentDays must be 0-31'),
    body('otHours').isNumeric().withMessage('otHours must be numeric'),
  ]),
  async (req, res) => {
    const { employeeId, subId, siteId, month, presentDays, otHours } = req.body;

    // Look up the sub-ID to get rate and salary_basis
    const { data: subRecord, error: subError } = await supabase
      .from('employee_sub_ids')
      .select('id, rate, salary_basis')
      .eq('id', subId)
      .eq('employee_id', employeeId)
      .single();

    if (subError || !subRecord) {
      return sendError(res, 'Sub-ID not found or does not belong to employee', 404);
    }

    const { rate: baseDailyWage, salary_basis: salaryBasis } = subRecord;

    // Compute OT
    const { presentWage, otRatePerHr, otAmount, totalAmount } = calculateOT(
      salaryBasis,
      Number(baseDailyWage),
      Number(presentDays),
      Number(otHours)
    );

    const attendanceRow = {
      employee_id: employeeId,
      sub_id: subId,
      site_id: siteId,
      month: `${month}-01`, // store as date
      present_days: presentDays,
      ot_hours: otHours,
      present_wage: presentWage,
      ot_rate_per_hr: otRatePerHr,
      ot_amount: otAmount,
      total_amount: totalAmount,
    };

    if (req.user.role === 'admin') {
      // Save attendance directly
      const { data: att, error: attError } = await supabase
        .from('attendance')
        .insert(attendanceRow)
        .select('id, employee_id, sub_id, site_id, month, present_days, ot_hours, present_wage, ot_rate_per_hr, ot_amount, total_amount, created_at')
        .single();

      if (attError) return sendError(res, attError.message, 400);

      // Create employee_ledger Credit entry
      const { error: ledgerError } = await supabase
        .from('employee_ledger')
        .insert({
          employee_id: employeeId,
          attendance_id: att.id,
          type: 'credit',
          credit_amount: totalAmount,
          debit_amount: 0,
          description: `Attendance for ${month}`,
          transaction_date: new Date().toISOString().split('T')[0],
        });

      if (ledgerError) {
        return sendError(res, `Attendance saved but ledger entry failed: ${ledgerError.message}`, 500);
      }

      return sendSuccess(res, att, 201);
    }

    // Supervisor: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'supervisor',
        requesterId: req.user.id,
        requesterName: req.user.name,
        siteId: siteId,
        module: 'Attendance',
        actionType: 'new_entry',
        newData: attendanceRow,
      });
      return sendSuccess(res, { approval, message: 'Attendance approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

module.exports = router;
