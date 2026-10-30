/**
 * Approval routes
 *
 * POST   /api/approvals                  — office/supervisor: submit approval request
 * GET    /api/approvals                  — list (admin: all; office/supervisor: own)
 * GET    /api/approvals/pending-counts   — admin only; returns { office, supervisor, loans }
 * PUT    /api/approvals/:id/approve      — admin only
 * PUT    /api/approvals/:id/reject       — admin only, remarks required
 */

const express = require('express');
const { body, query, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { createApprovalRequest, processApproval } = require('../services/approvalEngine');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// POST /api/approvals — office/supervisor submits an approval request
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('office', 'supervisor'),
  validate([
    body('source')
      .isIn(['office', 'supervisor'])
      .withMessage('source must be office or supervisor'),
    body('module')
      .notEmpty()
      .withMessage('module is required'),
    body('action_type')
      .isIn(['new_entry', 'edit', 'delete', 'status_toggle'])
      .withMessage('action_type must be one of: new_entry, edit, delete, status_toggle'),
    body('reason').optional().isString(),
    body('amount').optional().isFloat({ min: 0 }).withMessage('amount must be non-negative'),
    body('site_id').optional().isNumeric().withMessage('site_id must be numeric'),
  ]),
  async (req, res) => {
    const {
      source,
      module,
      action_type,
      reference_id,
      amount,
      old_data,
      new_data,
      reason,
      site_id,
    } = req.body;

    try {
      const approvalRequest = await createApprovalRequest({
        source,
        requesterId: req.user.id,
        requesterName: req.user.name,
        siteId: site_id || req.user.siteId || null,
        module,
        actionType: action_type,
        referenceId: reference_id || null,
        amount: amount || null,
        oldData: old_data || null,
        newData: new_data || null,
        reason: reason || null,
      });
      return sendSuccess(res, approvalRequest, 201);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/approvals/pending-counts — admin only
// Returns counts for dashboard bell icon: { office, supervisor, loans }
// NOTE: this route must be declared BEFORE /:id routes to avoid being captured
// ---------------------------------------------------------------------------
router.get(
  '/pending-counts',
  requireRole('admin'),
  async (req, res) => {
    const [officeResult, supervisorResult] = await Promise.all([
      supabase
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('source', 'office'),
      supabase
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('source', 'supervisor'),
    ]);

    if (officeResult.error) return sendError(res, officeResult.error.message, 500);
    if (supervisorResult.error) return sendError(res, supervisorResult.error.message, 500);

    return sendSuccess(res, {
      office: officeResult.count || 0,
      supervisor: supervisorResult.count || 0,
      loans: 0, // placeholder — loan approval module not yet implemented
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/approvals — list approval requests
// Admin: all requests. Office/supervisor: own requests only.
// Query params: status, source, module
// ---------------------------------------------------------------------------
router.get(
  '/',
  validate([
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected'])
      .withMessage('status must be pending, approved, or rejected'),
    query('source')
      .optional()
      .isIn(['office', 'supervisor'])
      .withMessage('source must be office or supervisor'),
    query('module').optional().isString(),
  ]),
  async (req, res) => {
    const { status, source, module } = req.query;
    const role = req.user.role;

    let q = supabase
      .from('approval_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // Non-admin users only see their own requests
    if (role !== 'admin') {
      q = q.eq('requester_id', req.user.id);
    }

    if (status) q = q.eq('status', status);
    if (source) q = q.eq('source', source);
    if (module) q = q.eq('module', module);

    const { data, error } = await q;
    if (error) return sendError(res, error.message, 500);

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/approvals/:id/approve — admin only
// ---------------------------------------------------------------------------
router.put(
  '/:id/approve',
  requireRole('admin'),
  validate([
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
  ]),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { remarks } = req.body;

    try {
      const result = await processApproval(id, 'approved', remarks || null, req.user.id);
      return sendSuccess(res, result);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/approvals/:id/reject — admin only, remarks required
// ---------------------------------------------------------------------------
router.put(
  '/:id/reject',
  requireRole('admin'),
  validate([
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('remarks').notEmpty().withMessage('remarks are required for rejection'),
  ]),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { remarks } = req.body;

    try {
      const result = await processApproval(id, 'rejected', remarks, req.user.id);
      return sendSuccess(res, result);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

module.exports = router;
