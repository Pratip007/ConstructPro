/**
 * Invoice routes
 *
 * GET    /api/invoices         — list invoices (filter: company_id, status, is_gst)
 * GET    /api/invoices/:id     — single invoice
 * POST   /api/invoices         — create invoice (gross_amount = base_amount + gst_amount)
 * PUT    /api/invoices/:id     — update invoice fields
 * DELETE /api/invoices/:id     — soft delete (status → 'cancelled')
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/invoices
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { company_id, status, is_gst } = req.query;

  let q = supabase
    .from('invoices')
    .select('id, display_id, po_id, company_id, site_name, date, base_amount, gst_amount, gross_amount, is_gst, status, file_path, created_at')
    .order('created_at', { ascending: false });

  if (company_id) q = q.eq('company_id', company_id);
  if (status) q = q.eq('status', status);
  if (is_gst !== undefined) q = q.eq('is_gst', is_gst === 'true');

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// GET /api/invoices/:id
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid invoice ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('invoices')
      .select('id, display_id, po_id, company_id, site_name, date, base_amount, gst_amount, gross_amount, is_gst, status, file_path, created_at')
      .eq('id', id)
      .single();

    if (error) return sendError(res, error.message, 500);
    if (!data) return sendError(res, 'Invoice not found', 404);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// POST /api/invoices
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('date').notEmpty().withMessage('date is required'),
    body('base_amount').isNumeric().withMessage('base_amount must be numeric'),
    body('company_id').optional().isUUID().withMessage('company_id must be a valid UUID'),
    body('po_id').optional().isUUID().withMessage('po_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const {
      po_id, company_id, site_name, date,
      base_amount, gst_amount, is_gst, file_path,
    } = req.body;

    const { count, error: countError } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('INV', (count || 0) + 1);

    const baseAmt = parseFloat(Number(base_amount).toFixed(2));
    const gstAmt = parseFloat(Number(gst_amount || 0).toFixed(2));
    const gross_amount = parseFloat(Number(baseAmt + gstAmt).toFixed(2));

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        display_id,
        po_id: po_id || null,
        company_id: company_id || null,
        site_name: site_name || null,
        date,
        base_amount: baseAmt,
        gst_amount: gstAmt,
        gross_amount,
        is_gst: is_gst !== undefined ? Boolean(is_gst) : false,
        status: 'unpaid',
        file_path: file_path || null,
      })
      .select('id, display_id, po_id, company_id, site_name, date, base_amount, gst_amount, gross_amount, is_gst, status, file_path, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/invoices/:id
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid invoice ID')]),
  async (req, res) => {
    const { id } = req.params;

    const allowedFields = ['po_id', 'company_id', 'site_name', 'date', 'base_amount', 'gst_amount', 'is_gst', 'status', 'file_path'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    // Recompute gross_amount if monetary fields are updated
    if (updates.base_amount !== undefined || updates.gst_amount !== undefined) {
      // Fetch current values to fill in the missing side
      const { data: current, error: fetchError } = await supabase
        .from('invoices')
        .select('base_amount, gst_amount')
        .eq('id', id)
        .single();

      if (fetchError) return sendError(res, fetchError.message, 500);
      if (!current) return sendError(res, 'Invoice not found', 404);

      const baseAmt = parseFloat(Number(updates.base_amount !== undefined ? updates.base_amount : current.base_amount).toFixed(2));
      const gstAmt = parseFloat(Number(updates.gst_amount !== undefined ? updates.gst_amount : current.gst_amount).toFixed(2));

      updates.base_amount = baseAmt;
      updates.gst_amount = gstAmt;
      updates.gross_amount = parseFloat(Number(baseAmt + gstAmt).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select('id, display_id, po_id, company_id, site_name, date, base_amount, gst_amount, gross_amount, is_gst, status, file_path, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Invoice not found', 404);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/invoices/:id
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid invoice ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Invoice not found', 404);
    return sendSuccess(res, { message: 'Invoice cancelled', invoice: data });
  }
);

module.exports = router;
