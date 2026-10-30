/**
 * Retailer Bill routes
 *
 * GET    /api/retailer-bills               — list bills (filter: site_id, retailer_id, status, gst_applicable)
 * GET    /api/retailer-bills/gst-report    — bills where gst_applicable = true
 * GET    /api/retailer-bills/non-gst-report — bills where gst_applicable = false
 * GET    /api/retailer-bills/:id           — single bill with items
 * POST   /api/retailer-bills               — create bill with nested cart_items[]
 * PUT    /api/retailer-bills/:id           — update bill header
 * DELETE /api/retailer-bills/:id           — soft delete (status → 'CANCELLED')
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
// Helpers
// ---------------------------------------------------------------------------
function computeBillItemTotals(item) {
  const qty = parseFloat(Number(item.qty).toFixed(2));
  const price = parseFloat(Number(item.price).toFixed(2));
  const gst_percent = parseFloat(Number(item.gst_percent || 0).toFixed(2));
  const unit = (item.unit || '').trim();

  // Percentage unit logic: base amount
  const isPercentage = unit === '%' || unit.toLowerCase() === 'percentage';
  const line_total = isPercentage
    ? parseFloat(Number((price * qty) / 100).toFixed(2))
    : parseFloat(Number(price * qty).toFixed(2));

  const line_gst = parseFloat(Number(line_total * gst_percent / 100).toFixed(2));
  const final_total = parseFloat(Number(line_total + line_gst).toFixed(2));

  return { qty, price, gst_percent, line_total, line_gst, final_total };
}

const BILL_SELECT = 'id, display_id, date, inv_type, inv_no, category, retailer_name, retailer_id, site_id, gst_applicable, gst_number, total_amount, paid_amount, due_amount, status, file_path, created_at';

// ---------------------------------------------------------------------------
// GET /api/retailer-bills/gst-report  (MUST be before /:id)
// ---------------------------------------------------------------------------
router.get('/gst-report', async (req, res) => {
  const { data, error } = await supabase
    .from('retailer_bills')
    .select(BILL_SELECT)
    .eq('gst_applicable', true)
    .order('created_at', { ascending: false });

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// GET /api/retailer-bills/non-gst-report  (MUST be before /:id)
// ---------------------------------------------------------------------------
router.get('/non-gst-report', async (req, res) => {
  const { data, error } = await supabase
    .from('retailer_bills')
    .select(BILL_SELECT)
    .eq('gst_applicable', false)
    .order('created_at', { ascending: false });

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// GET /api/retailer-bills
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { site_id, retailer_id, status, gst_applicable } = req.query;

  let q = supabase
    .from('retailer_bills')
    .select(BILL_SELECT)
    .order('created_at', { ascending: false });

  if (site_id) q = q.eq('site_id', site_id);
  if (retailer_id) q = q.eq('retailer_id', retailer_id);
  if (status) q = q.eq('status', status);
  if (gst_applicable !== undefined) q = q.eq('gst_applicable', gst_applicable === 'true');

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// GET /api/retailer-bills/:id
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid bill ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data: bill, error: billError } = await supabase
      .from('retailer_bills')
      .select(BILL_SELECT)
      .eq('id', id)
      .single();

    if (billError) return sendError(res, billError.message, 500);
    if (!bill) return sendError(res, 'Retailer bill not found', 404);

    const { data: items, error: itemsError } = await supabase
      .from('retailer_bill_items')
      .select('id, bill_id, item, qty, unit, price, gst_percent, line_total, line_gst, final_total, add_to_stock')
      .eq('bill_id', id);

    if (itemsError) return sendError(res, itemsError.message, 500);

    return sendSuccess(res, { ...bill, items: items || [] });
  }
);

// ---------------------------------------------------------------------------
// POST /api/retailer-bills
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('date').notEmpty().withMessage('date is required'),
    body('cart_items').isArray({ min: 1 }).withMessage('cart_items must be a non-empty array'),
    body('cart_items.*.item').notEmpty().withMessage('Each cart item must have an item name'),
    body('cart_items.*.qty').isNumeric().withMessage('Each cart item qty must be numeric'),
    body('cart_items.*.price').isNumeric().withMessage('Each cart item price must be numeric'),
    body('retailer_id').optional().isUUID().withMessage('retailer_id must be a valid UUID'),
    body('site_id').optional().isUUID().withMessage('site_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const {
      date, inv_type, inv_no, category, retailer_name,
      retailer_id, site_id, gst_applicable, gst_number,
      paid_amount, file_path, cart_items,
    } = req.body;

    const { count, error: countError } = await supabase
      .from('retailer_bills')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('BILL', (count || 0) + 1);

    // Compute item totals
    const computedItems = cart_items.map(computeBillItemTotals);

    // Bill totals
    const total_amount = parseFloat(computedItems.reduce((s, i) => s + i.final_total, 0).toFixed(2));
    const paidAmt = parseFloat(Number(paid_amount || 0).toFixed(2));
    const due_amount = parseFloat(Number(total_amount - paidAmt).toFixed(2));
    const billStatus = due_amount > 0 ? 'DUE' : 'PAID';

    // Insert bill
    const { data: bill, error: billError } = await supabase
      .from('retailer_bills')
      .insert({
        display_id,
        date,
        inv_type: inv_type || null,
        inv_no: inv_no || null,
        category: category || null,
        retailer_name: retailer_name || null,
        retailer_id: retailer_id || null,
        site_id: site_id || null,
        gst_applicable: gst_applicable !== undefined ? Boolean(gst_applicable) : false,
        gst_number: gst_number || null,
        total_amount,
        paid_amount: paidAmt,
        due_amount,
        status: billStatus,
        file_path: file_path || null,
      })
      .select(BILL_SELECT)
      .single();

    if (billError) return sendError(res, billError.message, 400);

    // Insert items
    const itemRows = cart_items.map((item, idx) => {
      const computed = computedItems[idx];
      return {
        bill_id: bill.id,
        item: item.item,
        qty: computed.qty,
        unit: item.unit || null,
        price: computed.price,
        gst_percent: computed.gst_percent,
        line_total: computed.line_total,
        line_gst: computed.line_gst,
        final_total: computed.final_total,
        add_to_stock: item.add_to_stock !== undefined ? Boolean(item.add_to_stock) : false,
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from('retailer_bill_items')
      .insert(itemRows)
      .select('id, bill_id, item, qty, unit, price, gst_percent, line_total, line_gst, final_total, add_to_stock');

    if (itemsError) return sendError(res, itemsError.message, 400);

    return sendSuccess(res, { ...bill, items: insertedItems || [] }, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/retailer-bills/:id
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid bill ID')]),
  async (req, res) => {
    const { id } = req.params;

    const allowedFields = [
      'date', 'inv_type', 'inv_no', 'category', 'retailer_name',
      'retailer_id', 'site_id', 'gst_applicable', 'gst_number',
      'paid_amount', 'status', 'file_path',
    ];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    // Recompute due_amount if paid_amount changed
    if (updates.paid_amount !== undefined) {
      const { data: current, error: fetchError } = await supabase
        .from('retailer_bills')
        .select('total_amount')
        .eq('id', id)
        .single();

      if (fetchError) return sendError(res, fetchError.message, 500);
      if (!current) return sendError(res, 'Retailer bill not found', 404);

      const paidAmt = parseFloat(Number(updates.paid_amount).toFixed(2));
      const due = parseFloat(Number(current.total_amount - paidAmt).toFixed(2));
      updates.paid_amount = paidAmt;
      updates.due_amount = due;
      updates.status = due > 0 ? 'DUE' : 'PAID';
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('retailer_bills')
      .update(updates)
      .eq('id', id)
      .select(BILL_SELECT)
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Retailer bill not found', 404);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/retailer-bills/:id
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid bill ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('retailer_bills')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Retailer bill not found', 404);
    return sendSuccess(res, { message: 'Retailer bill cancelled', bill: data });
  }
);

module.exports = router;
