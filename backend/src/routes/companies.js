/**
 * Company routes
 *
 * GET    /api/companies       — list companies (filter: status). All roles.
 * POST   /api/companies       — create company. Admin: direct. Office: approval.
 * PUT    /api/companies/:id   — update company. Admin: direct. Office: approval.
 * DELETE /api/companies/:id   — soft delete. Admin: direct. Office: approval.
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
// GET /api/companies
// All roles can list companies. Filter by status.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { status } = req.query;

  let q = supabase
    .from('companies')
    .select('id, display_id, name, gst_number, state_code, phone, email, address, custom_fields, status, created_at, updated_at')
    .order('name');

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// POST /api/companies
// Admin: inserts directly. Office: creates approval request. Supervisor: 403.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('gst_number').optional().isString(),
    body('email').optional().isEmail().withMessage('email must be a valid email'),
  ]),
  async (req, res) => {
    const { name, gst_number, state_code, phone, email, address, custom_fields } = req.body;
    const role = req.user.role;

    if (role === 'admin') {
      const { count, error: countError } = await supabase
        .from('companies')
        .select('id', { count: 'exact', head: true });

      if (countError) return sendError(res, countError.message, 500);
      const display_id = generateDisplayId('COMP', (count || 0) + 1);

      const { data, error } = await supabase
        .from('companies')
        .insert({
          display_id,
          name,
          gst_number: gst_number || null,
          state_code: state_code || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          custom_fields: custom_fields || null,
          status: 'active',
        })
        .select('id, display_id, name, gst_number, state_code, phone, email, address, custom_fields, status, created_at')
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
        module: 'Company',
        actionType: 'new_entry',
        newData: {
          name,
          gst_number: gst_number || null,
          state_code: state_code || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          custom_fields: custom_fields || null,
        },
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/companies/:id
// Admin: direct update. Office: approval request.
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid company ID'),
    body('email').optional().isEmail().withMessage('email must be a valid email'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    const allowedFields = ['name', 'gst_number', 'state_code', 'phone', 'email', 'address', 'custom_fields', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select('id, display_id, name, gst_number, state_code, phone, email, address, custom_fields, status, updated_at')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Company not found', 404);
      return sendSuccess(res, data);
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Company',
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
// DELETE /api/companies/:id
// Admin: soft delete (status → 'inactive'). Office: approval request.
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid company ID')]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('companies')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select('id, display_id, status')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Company not found', 404);
      return sendSuccess(res, { message: 'Company deactivated', company: data });
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Company',
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
