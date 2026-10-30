const express = require('express');
const { body, query } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/site-tagging
// Returns site tagging log entries. Filterable by employee_id.
// ---------------------------------------------------------------------------
router.get(
  '/',
  validate([
    query('employee_id').optional().isUUID().withMessage('employee_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const { employee_id } = req.query;

    let q = supabase
      .from('site_tagging')
      .select('id, employee_id, site_id, tagged_at, tagged_by, created_at')
      .order('tagged_at', { ascending: false });

    if (employee_id) q = q.eq('employee_id', employee_id);

    const { data, error } = await q;
    if (error) return sendError(res, error.message, 500);

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// POST /api/site-tagging
// Body: { employeeId, siteId }
// Updates employee's current_site_id and creates a site_tagging log entry.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('employeeId').isUUID().withMessage('employeeId must be a valid UUID'),
    body('siteId').isUUID().withMessage('siteId must be a valid UUID'),
  ]),
  async (req, res) => {
    const { employeeId, siteId } = req.body;

    // Update employee's current site
    const { error: updateError } = await supabase
      .from('employees')
      .update({ current_site_id: siteId })
      .eq('id', employeeId);

    if (updateError) {
      return sendError(res, updateError.message, 400);
    }

    // Create site_tagging log entry
    const { data, error } = await supabase
      .from('site_tagging')
      .insert({
        employee_id: employeeId,
        site_id: siteId,
        tagged_by: req.user.id,
        tagged_at: new Date().toISOString(),
      })
      .select('id, employee_id, site_id, tagged_at, tagged_by, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);

    return sendSuccess(res, data, 201);
  }
);

module.exports = router;
