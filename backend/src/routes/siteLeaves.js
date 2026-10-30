const express = require('express');
const { body, query } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { enforceSiteLock } = require('../middleware/sitelock');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/site-leaves
// Supervisor: own site only. Filter: employee_id, site_id, date.
// ---------------------------------------------------------------------------
router.get(
  '/',
  enforceSiteLock,
  validate([
    query('employee_id').optional().isUUID().withMessage('employee_id must be a valid UUID'),
    query('site_id').optional().isUUID().withMessage('site_id must be a valid UUID'),
    query('date').optional().isISO8601().withMessage('date must be a valid ISO date'),
  ]),
  async (req, res) => {
    const { employee_id, site_id, date } = req.query;

    let q = supabase
      .from('site_leaves')
      .select('id, employee_id, site_id, leave_date, reason, created_at')
      .order('leave_date', { ascending: false });

    if (employee_id) q = q.eq('employee_id', employee_id);
    if (site_id) q = q.eq('site_id', site_id);
    if (date) q = q.eq('leave_date', date);

    const { data, error } = await q;
    if (error) return sendError(res, error.message, 500);

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// POST /api/site-leaves
// Body: { date, employeeId, siteId, reason }
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office', 'supervisor'),
  enforceSiteLock,
  validate([
    body('date').isISO8601().withMessage('date must be a valid ISO date'),
    body('employeeId').isUUID().withMessage('employeeId must be a valid UUID'),
    body('siteId').isUUID().withMessage('siteId must be a valid UUID'),
    body('reason').optional().isString(),
  ]),
  async (req, res) => {
    const { date, employeeId, siteId, reason } = req.body;

    const { data, error } = await supabase
      .from('site_leaves')
      .insert({
        employee_id: employeeId,
        site_id: siteId,
        leave_date: date,
        reason: reason || null,
      })
      .select('id, employee_id, site_id, leave_date, reason, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);

    return sendSuccess(res, data, 201);
  }
);

module.exports = router;
