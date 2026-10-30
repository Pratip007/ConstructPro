/**
 * Retailer routes
 *
 * GET    /api/retailers             — list retailers (filter: status, site_id). Supervisor: site-locked.
 * POST   /api/retailers             — create retailer. Admin: direct. Office: approval.
 * PUT    /api/retailers/:id         — update retailer. Admin: direct. Office: approval.
 * DELETE /api/retailers/:id         — soft delete. Admin only.
 *
 * Retailer Categories (mounted at /api/retailer-categories):
 * GET    /api/retailer-categories   — list all active categories.
 * POST   /api/retailer-categories   — create category (admin/office).
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { enforceSiteLock } = require('../middleware/sitelock');
const { validate } = require('../middleware/validate');
const { createApprovalRequest } = require('../services/approvalEngine');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/retailers
// All roles can view. Supervisor: site-locked (auto-filtered to own site).
// Filter by status, site_id.
// ---------------------------------------------------------------------------
router.get('/', enforceSiteLock, async (req, res) => {
  const { status, site_id, category_id } = req.query;

  let q = supabase
    .from('retailers')
    .select('id, display_id, category_id, name, phone, address, gst_status, gst_number, site_id, status, created_at, updated_at')
    .order('name');

  if (site_id) q = q.eq('site_id', site_id);
  if (status) q = q.eq('status', status);
  if (category_id) q = q.eq('category_id', category_id);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// POST /api/retailers
// Admin: inserts directly. Office: creates approval request.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('site_id').optional().isUUID().withMessage('site_id must be a valid UUID'),
    body('category_id').optional().isUUID().withMessage('category_id must be a valid UUID'),
    body('gst_status')
      .optional()
      .isIn(['YES', 'NO'])
      .withMessage('gst_status must be YES or NO'),
  ]),
  async (req, res) => {
    const { name, phone, address, gst_status, gst_number, site_id, category_id } = req.body;
    const role = req.user.role;

    if (role === 'admin') {
      const { count, error: countError } = await supabase
        .from('retailers')
        .select('id', { count: 'exact', head: true });

      if (countError) return sendError(res, countError.message, 500);
      const display_id = generateDisplayId('RET', (count || 0) + 1);

      const { data, error } = await supabase
        .from('retailers')
        .insert({
          display_id,
          name,
          phone: phone || null,
          address: address || null,
          gst_status: gst_status || 'NO',
          gst_number: gst_number || null,
          site_id: site_id || null,
          category_id: category_id || null,
          status: 'active',
        })
        .select('id, display_id, category_id, name, phone, address, gst_status, gst_number, site_id, status, created_at')
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
        module: 'Retailer',
        actionType: 'new_entry',
        newData: {
          name,
          phone: phone || null,
          address: address || null,
          gst_status: gst_status || 'NO',
          gst_number: gst_number || null,
          site_id: site_id || null,
          category_id: category_id || null,
        },
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/retailers/:id
// Admin: direct update. Office: approval request.
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid retailer ID'),
    body('site_id').optional().isUUID().withMessage('site_id must be a valid UUID'),
    body('category_id').optional().isUUID().withMessage('category_id must be a valid UUID'),
    body('gst_status')
      .optional()
      .isIn(['YES', 'NO'])
      .withMessage('gst_status must be YES or NO'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    const allowedFields = ['name', 'phone', 'address', 'gst_status', 'gst_number', 'site_id', 'category_id', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('retailers')
        .update(updates)
        .eq('id', id)
        .select('id, display_id, category_id, name, phone, address, gst_status, gst_number, site_id, status, updated_at')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Retailer not found', 404);
      return sendSuccess(res, data);
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Retailer',
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
// DELETE /api/retailers/:id
// Admin only: soft delete (status → 'inactive'). Office: approval request.
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid retailer ID')]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('retailers')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select('id, display_id, status')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Retailer not found', 404);
      return sendSuccess(res, { message: 'Retailer deactivated', retailer: data });
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Retailer',
        actionType: 'delete',
        referenceId: id,
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// ---------------------------------------------------------------------------
// Retailer Categories sub-router
// GET  /api/retailer-categories   — list all categories (all authenticated)
// POST /api/retailer-categories   — create category (admin/office)
// ---------------------------------------------------------------------------
const retailerCategoriesRouter = express.Router();
retailerCategoriesRouter.use(authenticateToken);

// GET /api/retailer-categories
retailerCategoriesRouter.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('retailer_categories')
    .select('id, name, description, status, created_at, updated_at')
    .order('name');

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/retailer-categories
retailerCategoriesRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
  ]),
  async (req, res) => {
    const { name, description } = req.body;

    const { data, error } = await supabase
      .from('retailer_categories')
      .insert({
        name,
        description: description || null,
        status: 'active',
      })
      .select('id, name, description, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// PUT /api/retailer-categories/:id
retailerCategoriesRouter.put(
  '/:id',
  requireRole('admin'),
  validate([
    param('id').isUUID().withMessage('Invalid category ID'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const allowedFields = ['name', 'description', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('retailer_categories')
      .update(updates)
      .eq('id', id)
      .select('id, name, description, status, updated_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Category not found', 404);
    return sendSuccess(res, data);
  }
);

module.exports = { retailersRouter: router, retailerCategoriesRouter };
