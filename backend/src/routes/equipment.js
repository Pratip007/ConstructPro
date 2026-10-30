/**
 * Equipment routes
 *
 * Equipment Categories (/api/equipment-categories):
 * GET    /    — list all
 * POST   /    — create (admin only)
 * PUT    /:id — update (admin only)
 * DELETE /:id — soft delete (admin only)
 *
 * Equipment Parties (/api/equipment):
 * GET    /    — list all, filter by status, category_id
 * POST   /    — create. Admin/office. Display_id prefix: EQP
 * PUT    /:id — update fields
 * DELETE /:id — soft delete
 *
 * Equipment Site Assignments (/api/equipment-site-assignments):
 * GET    /    — list, filter by equipment_party_id, site_id, status
 * POST   /    — create assignment. Display_id prefix: ESA
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

// ---------------------------------------------------------------------------
// Equipment Categories Router
// ---------------------------------------------------------------------------
const equipmentCategoriesRouter = express.Router();
equipmentCategoriesRouter.use(authenticateToken);

// GET /api/equipment-categories
equipmentCategoriesRouter.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('equipment_categories')
    .select('id, name, description, status, created_at, updated_at')
    .order('name');

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/equipment-categories
equipmentCategoriesRouter.post(
  '/',
  requireRole('admin'),
  validate([body('name').notEmpty().withMessage('name is required')]),
  async (req, res) => {
    const { name, description } = req.body;

    const { data, error } = await supabase
      .from('equipment_categories')
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

// PUT /api/equipment-categories/:id
equipmentCategoriesRouter.put(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid category ID')]),
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
      .from('equipment_categories')
      .update(updates)
      .eq('id', id)
      .select('id, name, description, status, updated_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Category not found', 404);
    return sendSuccess(res, data);
  }
);

// DELETE /api/equipment-categories/:id
equipmentCategoriesRouter.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid category ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('equipment_categories')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, name, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Category not found', 404);
    return sendSuccess(res, { message: 'Category deactivated', category: data });
  }
);

// ---------------------------------------------------------------------------
// Equipment Parties Router
// ---------------------------------------------------------------------------
const equipmentRouter = express.Router();
equipmentRouter.use(authenticateToken);

// GET /api/equipment
equipmentRouter.get('/', async (req, res) => {
  const { status, category_id } = req.query;

  let q = supabase
    .from('equipment_parties')
    .select('id, display_id, name, contact, address, category_id, status, created_at, updated_at')
    .order('name');

  if (status) q = q.eq('status', status);
  if (category_id) q = q.eq('category_id', category_id);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/equipment
equipmentRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('category_id').optional().isUUID().withMessage('category_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const { name, contact, address, category_id } = req.body;

    const { count, error: countError } = await supabase
      .from('equipment_parties')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('EQP', (count || 0) + 1);

    const { data, error } = await supabase
      .from('equipment_parties')
      .insert({
        display_id,
        name,
        contact: contact || null,
        address: address || null,
        category_id: category_id || null,
        status: 'active',
      })
      .select('id, display_id, name, contact, address, category_id, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// PUT /api/equipment/:id
equipmentRouter.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid equipment ID'),
    body('category_id').optional().isUUID().withMessage('category_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const allowedFields = ['name', 'contact', 'address', 'category_id', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('equipment_parties')
      .update(updates)
      .eq('id', id)
      .select('id, display_id, name, contact, address, category_id, status, updated_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Equipment not found', 404);
    return sendSuccess(res, data);
  }
);

// DELETE /api/equipment/:id
equipmentRouter.delete(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid equipment ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('equipment_parties')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Equipment not found', 404);
    return sendSuccess(res, { message: 'Equipment deactivated', equipment: data });
  }
);

// ---------------------------------------------------------------------------
// Equipment Site Assignments Router
// ---------------------------------------------------------------------------
const equipmentSiteAssignmentsRouter = express.Router();
equipmentSiteAssignmentsRouter.use(authenticateToken);

// GET /api/equipment-site-assignments
equipmentSiteAssignmentsRouter.get('/', async (req, res) => {
  const { equipment_party_id, site_id, status } = req.query;

  let q = supabase
    .from('equipment_site_assignments')
    .select('id, display_id, equipment_party_id, site_id, assigned_date, released_date, rate, rate_unit, status, remarks, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (equipment_party_id) q = q.eq('equipment_party_id', equipment_party_id);
  if (site_id) q = q.eq('site_id', site_id);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/equipment-site-assignments
equipmentSiteAssignmentsRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('equipment_party_id').isUUID().withMessage('equipment_party_id must be a valid UUID'),
    body('site_id').isUUID().withMessage('site_id must be a valid UUID'),
    body('assigned_date').notEmpty().withMessage('assigned_date is required'),
    body('rate').optional().isNumeric().withMessage('rate must be numeric'),
  ]),
  async (req, res) => {
    const { equipment_party_id, site_id, assigned_date, released_date, rate, rate_unit, remarks } = req.body;

    const { count, error: countError } = await supabase
      .from('equipment_site_assignments')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('ESA', (count || 0) + 1);

    const { data, error } = await supabase
      .from('equipment_site_assignments')
      .insert({
        display_id,
        equipment_party_id,
        site_id,
        assigned_date,
        released_date: released_date || null,
        rate: rate != null ? parseFloat(Number(rate).toFixed(2)) : null,
        rate_unit: rate_unit || null,
        status: 'active',
        remarks: remarks || null,
      })
      .select('id, display_id, equipment_party_id, site_id, assigned_date, released_date, rate, rate_unit, status, remarks, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

module.exports = { equipmentCategoriesRouter, equipmentRouter, equipmentSiteAssignmentsRouter };
