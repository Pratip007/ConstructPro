/**
 * Contractor routes
 *
 * GET    /api/contractors       — list contractors (filter: status, category). All roles.
 * POST   /api/contractors       — create contractor. Admin: direct. Office: approval.
 * PUT    /api/contractors/:id   — update contractor. Admin: direct. Office: approval.
 * DELETE /api/contractors/:id   — soft delete. Admin: password-confirmed soft delete. Office: approval.
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase, supabaseAnon } = require('../config/supabase');
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
// GET /api/contractors
// All roles can list contractors. Filter by status, category.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { status, category } = req.query;

  let q = supabase
    .from('contractors')
    .select('id, display_id, name, phone, email, pan, gst_number, category, address, tds_applicable, tds_percent, avatar_url, status, created_at, updated_at')
    .order('name');

  if (status) q = q.eq('status', status);
  if (category) q = q.eq('category', category);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// POST /api/contractors
// Admin: inserts directly. Office: creates approval request.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('tds_percent')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('tds_percent must be between 0 and 100'),
    body('email').optional().isEmail().withMessage('email must be a valid email'),
  ]),
  async (req, res) => {
    const {
      name, phone, email, pan, gst_number, category,
      address, tds_applicable, tds_percent, avatar_url,
    } = req.body;
    const role = req.user.role;

    if (role === 'admin') {
      const { count, error: countError } = await supabase
        .from('contractors')
        .select('id', { count: 'exact', head: true });

      if (countError) return sendError(res, countError.message, 500);
      const display_id = generateDisplayId('CON', (count || 0) + 1);

      const { data, error } = await supabase
        .from('contractors')
        .insert({
          display_id,
          name,
          phone: phone || null,
          email: email || null,
          pan: pan || null,
          gst_number: gst_number || null,
          category: category || null,
          address: address || null,
          tds_applicable: tds_applicable || false,
          tds_percent: tds_percent != null ? parseFloat(Number(tds_percent).toFixed(2)) : null,
          avatar_url: avatar_url || null,
          status: 'active',
        })
        .select('id, display_id, name, phone, email, pan, gst_number, category, address, tds_applicable, tds_percent, avatar_url, status, created_at')
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
        module: 'Contractor',
        actionType: 'new_entry',
        newData: {
          name,
          phone: phone || null,
          email: email || null,
          pan: pan || null,
          gst_number: gst_number || null,
          category: category || null,
          address: address || null,
          tds_applicable: tds_applicable || false,
          tds_percent: tds_percent != null ? parseFloat(Number(tds_percent).toFixed(2)) : null,
          avatar_url: avatar_url || null,
        },
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/contractors/:id
// Admin: direct update. Office: approval request.
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid contractor ID'),
    body('tds_percent')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('tds_percent must be between 0 and 100'),
    body('email').optional().isEmail().withMessage('email must be a valid email'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    const allowedFields = ['name', 'phone', 'email', 'pan', 'gst_number', 'category', 'address', 'tds_applicable', 'tds_percent', 'avatar_url', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (updates.tds_percent !== undefined) {
      updates.tds_percent = parseFloat(Number(updates.tds_percent).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('contractors')
        .update(updates)
        .eq('id', id)
        .select('id, display_id, name, phone, email, pan, gst_number, category, address, tds_applicable, tds_percent, avatar_url, status, updated_at')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Contractor not found', 404);
      return sendSuccess(res, data);
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Contractor',
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
// DELETE /api/contractors/:id
// Admin: soft delete with password confirmation. Office: approval request.
// Password confirmation: verify admin credentials before soft-deleting.
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid contractor ID')]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    if (role === 'admin') {
      const { password } = req.body;

      if (!password) {
        return sendError(res, 'Password confirmation required for delete', 400);
      }

      // Look up the admin's email from Supabase Auth
      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(req.user.authUid);
      if (authUserError || !authUserData?.user?.email) {
        return sendError(res, 'Could not retrieve admin credentials', 500);
      }

      const adminEmail = authUserData.user.email;

      // Verify admin password using anon client to avoid corrupting service-role session
      const { error: authError } = await supabaseAnon.auth.signInWithPassword({
        email: adminEmail,
        password,
      });

      if (authError) {
        return sendError(res, 'Password verification failed', 403);
      }

      // Soft delete: status → 'inactive'
      const { data, error } = await supabase
        .from('contractors')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select('id, display_id, status')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Contractor not found', 404);
      return sendSuccess(res, { message: 'Contractor deactivated', contractor: data });
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Contractor',
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
