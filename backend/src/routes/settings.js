/**
 * Settings routes
 *
 * Terms & Conditions (/api/settings/terms):
 * GET    /       — list all, filter by module, status. All roles.
 * POST   /       — admin: direct insert. Office: approval request.
 * PUT    /:id    — admin only.
 * DELETE /:id    — admin only, soft delete.
 *
 * Head Allotments (/api/settings/heads):
 * GET    /       — list all, filter by type. All roles.
 * POST   /       — admin only.
 * PUT    /:id    — admin only.
 * DELETE /:id    — admin only, soft delete.
 *
 * Menu Allotments (/api/settings/menus):
 * GET    /:profileId — list all menu allotments for a profile.
 * PUT    /:profileId — admin only. Replace all menu allotments for a profile.
 *
 * Note: equipment-categories are already mounted at /api/equipment-categories (equipment.js Task 9).
 *       retailer-categories are already mounted at /api/retailer-categories (retailers.js Task 7).
 *       Neither is duplicated here.
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { createApprovalRequest } = require('../services/approvalEngine');

// ===========================================================================
// Terms & Conditions Router
// ===========================================================================
const termsRouter = express.Router();
termsRouter.use(authenticateToken);

// GET /api/settings/terms
termsRouter.get('/', async (req, res) => {
  const { module, status } = req.query;

  let q = supabase
    .from('terms_conditions')
    .select('id, title, content, module, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (module) q = q.eq('module', module);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/settings/terms
termsRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('title').notEmpty().withMessage('title is required'),
    body('content').notEmpty().withMessage('content is required'),
    body('module').optional().isString(),
  ]),
  async (req, res) => {
    const { title, content, module } = req.body;
    const role = req.user.role;

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('terms_conditions')
        .insert({
          title,
          content,
          module: module || null,
          status: 'active',
        })
        .select('id, title, content, module, status, created_at')
        .single();

      if (error) return sendError(res, error.message, 400);
      return sendSuccess(res, data, 201);
    }

    // Office: approval request
    try {
      const approval = await createApprovalRequest({
        source: 'office',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'TermsConditions',
        actionType: 'new_entry',
        newData: {
          title,
          content,
          module: module || null,
          status: 'active',
        },
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  }
);

// PUT /api/settings/terms/:id
termsRouter.put(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid terms ID')]),
  async (req, res) => {
    const { id } = req.params;

    const allowedFields = ['title', 'content', 'module', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('terms_conditions')
      .update(updates)
      .eq('id', id)
      .select('id, title, content, module, status, updated_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Terms & Conditions record not found', 404);
    return sendSuccess(res, data);
  }
);

// DELETE /api/settings/terms/:id
termsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid terms ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('terms_conditions')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, title, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Terms & Conditions record not found', 404);
    return sendSuccess(res, { message: 'Terms & Conditions deactivated', terms: data });
  }
);

// ===========================================================================
// Head Allotments Router
// ===========================================================================
const headsRouter = express.Router();
headsRouter.use(authenticateToken);

// GET /api/settings/heads
headsRouter.get('/', async (req, res) => {
  const { type, status } = req.query;

  let q = supabase
    .from('head_allotments')
    .select('id, name, type, description, status, created_at, updated_at')
    .order('name');

  if (type) q = q.eq('type', type);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/settings/heads
headsRouter.post(
  '/',
  requireRole('admin'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('type')
      .notEmpty()
      .withMessage('type is required')
      .isIn(['Income', 'Expense'])
      .withMessage("type must be 'Income' or 'Expense'"),
    body('description').optional().isString(),
  ]),
  async (req, res) => {
    const { name, type, description } = req.body;

    const { data, error } = await supabase
      .from('head_allotments')
      .insert({
        name,
        type,
        description: description || null,
        status: 'active',
      })
      .select('id, name, type, description, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// PUT /api/settings/heads/:id
headsRouter.put(
  '/:id',
  requireRole('admin'),
  validate([
    param('id').isUUID().withMessage('Invalid head allotment ID'),
    body('type')
      .optional()
      .isIn(['Income', 'Expense'])
      .withMessage("type must be 'Income' or 'Expense'"),
  ]),
  async (req, res) => {
    const { id } = req.params;

    const allowedFields = ['name', 'type', 'description', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('head_allotments')
      .update(updates)
      .eq('id', id)
      .select('id, name, type, description, status, updated_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Head allotment not found', 404);
    return sendSuccess(res, data);
  }
);

// DELETE /api/settings/heads/:id
headsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid head allotment ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('head_allotments')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, name, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Head allotment not found', 404);
    return sendSuccess(res, { message: 'Head allotment deactivated', head: data });
  }
);

// ===========================================================================
// Menu Allotments Router
// ===========================================================================
const menusRouter = express.Router();
menusRouter.use(authenticateToken);

// GET /api/settings/menus/:profileId
menusRouter.get(
  '/:profileId',
  validate([param('profileId').isUUID().withMessage('Invalid profile ID')]),
  async (req, res) => {
    const { profileId } = req.params;

    const { data, error } = await supabase
      .from('menu_allotments')
      .select('id, profile_id, menu_item_id, menu_name, menu_url, granted, created_at')
      .eq('profile_id', profileId)
      .order('menu_name');

    if (error) return sendError(res, error.message, 500);
    return sendSuccess(res, data);
  }
);

// PUT /api/settings/menus/:profileId
// Replace all menu allotments for a profile (delete + bulk insert)
menusRouter.put(
  '/:profileId',
  requireRole('admin'),
  validate([
    param('profileId').isUUID().withMessage('Invalid profile ID'),
    body('menuItems').isArray().withMessage('menuItems must be an array'),
    body('menuItems.*.menuItemId').notEmpty().withMessage('Each menuItem must have menuItemId'),
    body('menuItems.*.menuName').notEmpty().withMessage('Each menuItem must have menuName'),
    body('menuItems.*.granted').isBoolean().withMessage('Each menuItem granted must be boolean'),
  ]),
  async (req, res) => {
    const { profileId } = req.params;
    const { menuItems } = req.body;

    // Delete all existing allotments for this profile
    const { error: deleteError } = await supabase
      .from('menu_allotments')
      .delete()
      .eq('profile_id', profileId);

    if (deleteError) return sendError(res, deleteError.message, 500);

    // Bulk insert new allotments (skip if empty)
    if (!menuItems || menuItems.length === 0) {
      return sendSuccess(res, { message: 'Menu allotments cleared', items: [] });
    }

    const rows = menuItems.map((item) => ({
      profile_id: profileId,
      menu_item_id: item.menuItemId,
      menu_name: item.menuName,
      menu_url: item.menuUrl || null,
      granted: Boolean(item.granted),
    }));

    const { data, error } = await supabase
      .from('menu_allotments')
      .insert(rows)
      .select('id, profile_id, menu_item_id, menu_name, menu_url, granted, created_at');

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, { message: 'Menu allotments updated', items: data });
  }
);

module.exports = { termsRouter, headsRouter, menusRouter };
