const express = require('express');
const { body } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/employee-categories
// Returns all employee categories (position types).
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('employee_categories')
    .select('id, display_id, name, working_days, created_at, updated_at')
    .order('name');

  if (error) {
    return sendError(res, error.message, 500);
  }

  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// POST /api/employee-categories
// Admin/office only: create a new category.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('working_days')
      .optional()
      .isInt({ min: 1, max: 31 })
      .withMessage('working_days must be between 1 and 31'),
  ]),
  async (req, res) => {
    const { name, working_days } = req.body;

    // Get next sequence for display_id
    const { count } = await supabase
      .from('employee_categories')
      .select('id', { count: 'exact', head: true });

    const seq = (count || 0) + 1;
    const display_id = `CAT-${String(seq).padStart(3, '0')}`;

    const { data, error } = await supabase
      .from('employee_categories')
      .insert({ display_id, name, working_days: working_days || null })
      .select('id, display_id, name, working_days, created_at')
      .single();

    if (error) {
      return sendError(res, error.message, 400);
    }

    return sendSuccess(res, data, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/employee-categories/:id
// Admin/office only: update a category.
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('working_days')
      .optional()
      .isInt({ min: 1, max: 31 })
      .withMessage('working_days must be between 1 and 31'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.working_days !== undefined) updates.working_days = req.body.working_days;

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('employee_categories')
      .update(updates)
      .eq('id', id)
      .select('id, display_id, name, working_days, updated_at')
      .single();

    if (error) {
      return sendError(res, error.message, 400);
    }
    if (!data) {
      return sendError(res, 'Category not found', 404);
    }

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/employee-categories/:id
// Admin only: delete a category.
// ---------------------------------------------------------------------------
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('employee_categories')
    .delete()
    .eq('id', id);

  if (error) {
    return sendError(res, error.message, 400);
  }

  return sendSuccess(res, { message: 'Category deleted' });
});

module.exports = router;
