/**
 * Bank routes
 *
 * GET    /api/banks       — list all active banks. All authenticated roles.
 * POST   /api/banks       — create bank. Admin only.
 * PUT    /api/banks/:id   — update bank. Admin only.
 * DELETE /api/banks/:id   — soft delete. Admin only.
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/banks
// All authenticated users can view banks.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('banks')
    .select('id, bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance, status, created_at, updated_at')
    .eq('status', 'active')
    .order('bank_name');

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// POST /api/banks
// Admin only: create a new bank.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin'),
  validate([
    body('bank_name').notEmpty().withMessage('bank_name is required'),
    body('account_number').notEmpty().withMessage('account_number is required'),
    body('ifsc_code').notEmpty().withMessage('ifsc_code is required'),
    body('account_type').notEmpty().withMessage('account_type is required'),
    body('holder_name').notEmpty().withMessage('holder_name is required'),
    body('opening_balance')
      .optional()
      .isNumeric()
      .withMessage('opening_balance must be numeric'),
  ]),
  async (req, res) => {
    const { bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance } = req.body;

    const { data, error } = await supabase
      .from('banks')
      .insert({
        bank_name,
        branch_name: branch_name || null,
        account_number,
        ifsc_code,
        account_type,
        holder_name,
        opening_balance: opening_balance != null ? parseFloat(Number(opening_balance).toFixed(2)) : 0,
        status: 'active',
      })
      .select('id, bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/banks/:id
// Admin only: update bank details.
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin'),
  validate([
    param('id').isUUID().withMessage('Invalid bank ID'),
    body('opening_balance')
      .optional()
      .isNumeric()
      .withMessage('opening_balance must be numeric'),
  ]),
  async (req, res) => {
    const { id } = req.params;

    const allowedFields = ['bank_name', 'branch_name', 'account_number', 'ifsc_code', 'account_type', 'holder_name', 'opening_balance', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (updates.opening_balance !== undefined) {
      updates.opening_balance = parseFloat(Number(updates.opening_balance).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('banks')
      .update(updates)
      .eq('id', id)
      .select('id, bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance, status, updated_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Bank not found', 404);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/banks/:id
// Admin only: soft delete (status → 'inactive').
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid bank ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('banks')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, bank_name, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Bank not found', 404);
    return sendSuccess(res, { message: 'Bank deactivated', bank: data });
  }
);

module.exports = router;
