/**
 * Balance Received routes
 *
 * GET  /api/balance-received          — list by invoice_id
 * POST /api/balance-received          — record a payment/TDS and recalculate invoice status
 */

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
// GET /api/balance-received
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { invoice_id } = req.query;

  let q = supabase
    .from('balance_received')
    .select('id, invoice_id, date, entry_type, amount, tds_amount, payment_method, reference_number, remarks, created_at')
    .order('created_at', { ascending: false });

  if (invoice_id) q = q.eq('invoice_id', invoice_id);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// POST /api/balance-received
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('invoiceId').isUUID().withMessage('invoiceId must be a valid UUID'),
    body('date').notEmpty().withMessage('date is required'),
    body('amount').isNumeric().withMessage('amount must be numeric'),
    body('entryType')
      .isIn(['PAYMENT', 'TDS'])
      .withMessage("entryType must be 'PAYMENT' or 'TDS'"),
  ]),
  async (req, res) => {
    const {
      invoiceId, date, amount, tdsAmount,
      entryType, paymentMethod, referenceNumber, remarks,
    } = req.body;

    const parsedAmount = parseFloat(Number(amount).toFixed(2));
    const parsedTdsAmount = tdsAmount != null ? parseFloat(Number(tdsAmount).toFixed(2)) : null;

    // Insert balance_received record
    const { data: record, error: insertError } = await supabase
      .from('balance_received')
      .insert({
        invoice_id: invoiceId,
        date,
        entry_type: entryType,
        amount: parsedAmount,
        tds_amount: parsedTdsAmount,
        payment_method: paymentMethod || null,
        reference_number: referenceNumber || null,
        remarks: remarks || null,
      })
      .select('id, invoice_id, date, entry_type, amount, tds_amount, payment_method, reference_number, remarks, created_at')
      .single();

    if (insertError) return sendError(res, insertError.message, 400);

    // Fetch the invoice's gross_amount
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, gross_amount')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) return sendError(res, invoiceError.message, 500);
    if (!invoice) return sendError(res, 'Invoice not found', 404);

    // Sum all balance_received amounts for this invoice
    const { data: sumData, error: sumError } = await supabase
      .from('balance_received')
      .select('amount')
      .eq('invoice_id', invoiceId);

    if (sumError) return sendError(res, sumError.message, 500);

    const totalReceived = parseFloat(
      (sumData || []).reduce((s, r) => s + Number(r.amount), 0).toFixed(2)
    );

    const grossAmount = parseFloat(Number(invoice.gross_amount).toFixed(2));

    let newStatus;
    if (totalReceived >= grossAmount) {
      newStatus = 'paid';
    } else if (totalReceived > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'unpaid';
    }

    // Update invoice status
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoiceId);

    if (updateError) return sendError(res, updateError.message, 500);

    return sendSuccess(res, { record, invoiceStatus: newStatus, totalReceived }, 201);
  }
);

module.exports = router;
