const express = require('express');
const { param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/employee-ledger/:employeeId
// Returns all credit/debit entries ordered by date with running balance.
// Employee role: can only access own ledger.
// ---------------------------------------------------------------------------
router.get(
  '/:employeeId',
  validate([
    param('employeeId').isUUID().withMessage('employeeId must be a valid UUID'),
  ]),
  async (req, res) => {
    const { employeeId } = req.params;

    // Employee can only access own ledger
    if (req.user.role === 'employee' && req.user.id !== employeeId) {
      return sendError(res, 'Access denied: can only view your own ledger', 403);
    }

    const { data, error } = await supabase
      .from('employee_ledger')
      .select('id, employee_id, attendance_id, type, credit_amount, debit_amount, description, transaction_date, created_at')
      .eq('employee_id', employeeId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) return sendError(res, error.message, 500);

    // Compute running balance
    let runningBalance = 0;
    const entriesWithBalance = data.map((entry) => {
      runningBalance += Number(entry.credit_amount || 0) - Number(entry.debit_amount || 0);
      return { ...entry, running_balance: runningBalance };
    });

    return sendSuccess(res, entriesWithBalance);
  }
);

module.exports = router;
