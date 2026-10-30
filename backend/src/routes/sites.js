/**
 * Site routes
 *
 * GET    /api/sites       — list sites (filter: company_id, status). All roles.
 * POST   /api/sites       — create site. Admin: direct. Office: approval.
 * PUT    /api/sites/:id   — update site. Admin: direct. Office: approval.
 * DELETE /api/sites/:id   — soft delete. Admin: direct. Office: approval.
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { createApprovalRequest } = require('../services/approvalEngine');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/sites
// All roles can list sites. Filter by company_id, status.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { company_id, status } = req.query;

  let q = supabase
    .from('sites')
    .select('id, display_id, name, company_id, address, status, created_at, updated_at')
    .order('name');

  if (company_id) q = q.eq('company_id', company_id);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// POST /api/sites
// Admin: inserts directly. Office: creates approval request.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('company_id').optional().isUUID().withMessage('company_id must be a valid UUID'),
    body('status')
      .optional()
      .isIn(['active', 'completed', 'upcoming'])
      .withMessage('status must be active, completed, or upcoming'),
  ]),
  async (req, res) => {
    const { name, company_id, address, status } = req.body;
    const role = req.user.role;

    if (role === 'admin') {
      const { count, error: countError } = await supabase
        .from('sites')
        .select('id', { count: 'exact', head: true });

      if (countError) return sendError(res, countError.message, 500);
      const display_id = generateDisplayId('SITE', (count || 0) + 1);

      const { data, error } = await supabase
        .from('sites')
        .insert({
          display_id,
          name,
          company_id,
          address: address || null,
          status: status || 'active',
        })
        .select('id, display_id, name, company_id, address, status, created_at')
        .single();

      if (error) return sendError(res, error.message, 400);
      return sendSuccess(res, data, 201);
    }

    // Office: create approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Site',
        actionType: 'new_entry',
        newData: {
          name,
          company_id,
          address: address || null,
          status: status || 'active',
        },
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/sites/:id
// Admin: direct update. Office: approval request.
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid site ID'),
    body('company_id').optional().isUUID().withMessage('company_id must be a valid UUID'),
    body('status')
      .optional()
      .isIn(['active', 'completed', 'upcoming'])
      .withMessage('status must be active, completed, or upcoming'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    const allowedFields = ['name', 'company_id', 'address', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('sites')
        .update(updates)
        .eq('id', id)
        .select('id, display_id, name, company_id, address, status, updated_at')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Site not found', 404);
      return sendSuccess(res, data);
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Site',
        actionType: 'edit',
        referenceId: id,
        newData: updates,
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/sites/:id
// Admin: soft delete (status → 'inactive'). Office: approval request.
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid site ID')]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('sites')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select('id, display_id, status')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Site not found', 404);
      return sendSuccess(res, { message: 'Site deactivated', site: data });
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Site',
        actionType: 'delete',
        referenceId: id,
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

module.exports = router;
