/**
 * Purchase Order routes
 *
 * GET    /api/purchase-orders         — list POs (filter: site_id, status)
 * GET    /api/purchase-orders/:id     — single PO with items
 * POST   /api/purchase-orders         — create PO with nested items[]
 * PUT    /api/purchase-orders/:id     — update PO header (optionally replace items)
 * DELETE /api/purchase-orders/:id     — soft delete (status → 'inactive')
 */

const express = require('express');
const { body, param, query } = require('express-validator');

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
function computeItemTotals(item) {
  const qty = parseFloat(Number(item.qty).toFixed(2));
  const price = parseFloat(Number(item.price).toFixed(2));
  const gst_percent = parseFloat(Number(item.gst_percent || 0).toFixed(2));
  const unit = (item.unit || '').trim();

  const isPercentage = unit === '%' || unit.toLowerCase() === 'percentage';
  const base_total = isPercentage
    ? parseFloat(Number((price * qty) / 100).toFixed(2))
    : parseFloat(Number(price * qty).toFixed(2));

  const gst_amount = parseFloat(Number(base_total * gst_percent / 100).toFixed(2));
  const line_total = parseFloat(Number(base_total + gst_amount).toFixed(2));

  return { qty, price, gst_percent, base_total, gst_amount, line_total };
}

// ---------------------------------------------------------------------------
// GET /api/purchase-orders
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { site_id, status } = req.query;

  let q = supabase
    .from('purchase_orders')
    .select('id, display_id, date, site_id, retailer_id, base_amount, gst_amount, net_amount, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (site_id) q = q.eq('site_id', site_id);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// GET /api/purchase-orders/:id
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid PO ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, display_id, date, site_id, retailer_id, base_amount, gst_amount, net_amount, status, created_at, updated_at')
      .eq('id', id)
      .single();

    if (poError) return sendError(res, poError.message, 500);
    if (!po) return sendError(res, 'Purchase order not found', 404);

    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('id, order_id, product_id, name, hsn, unit, qty, price, gst_percent, gst_amount, line_total')
      .eq('order_id', id);

    if (itemsError) return sendError(res, itemsError.message, 500);

    return sendSuccess(res, { ...po, items: items || [] });
  }
);

// ---------------------------------------------------------------------------
// POST /api/purchase-orders
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('date').notEmpty().withMessage('date is required'),
    body('site_id').optional().isUUID().withMessage('site_id must be a valid UUID'),
    body('retailer_id').optional().isUUID().withMessage('retailer_id must be a valid UUID'),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.name').notEmpty().withMessage('Each item must have a name'),
    body('items.*.qty').isNumeric().withMessage('Each item qty must be numeric'),
    body('items.*.price').isNumeric().withMessage('Each item price must be numeric'),
  ]),
  async (req, res) => {
    const { date, site_id, retailer_id, items, status } = req.body;

    // Count existing POs for display_id generation
    const { count, error: countError } = await supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('PO', (count || 0) + 1);

    // Compute item totals
    const computedItems = items.map(computeItemTotals);

    // Compute PO totals
    const base_amount = parseFloat(computedItems.reduce((s, i) => s + i.base_total, 0).toFixed(2));
    const gst_amount = parseFloat(computedItems.reduce((s, i) => s + i.gst_amount, 0).toFixed(2));
    const net_amount = parseFloat(Number(base_amount + gst_amount).toFixed(2));

    // Insert PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        display_id,
        date,
        site_id: site_id || null,
        retailer_id: retailer_id || null,
        base_amount,
        gst_amount,
        net_amount,
        status: status || 'active',
      })
      .select('id, display_id, date, site_id, retailer_id, base_amount, gst_amount, net_amount, status, created_at')
      .single();

    if (poError) return sendError(res, poError.message, 400);

    // Insert items
    const itemRows = items.map((item, idx) => {
      const computed = computedItems[idx];
      return {
        order_id: po.id,
        product_id: item.product_id || null,
        name: item.name,
        hsn: item.hsn || null,
        unit: item.unit || null,
        qty: computed.qty,
        price: computed.price,
        gst_percent: computed.gst_percent,
        gst_amount: computed.gst_amount,
        line_total: computed.line_total,
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemRows)
      .select('id, order_id, product_id, name, hsn, unit, qty, price, gst_percent, gst_amount, line_total');

    if (itemsError) return sendError(res, itemsError.message, 400);

    return sendSuccess(res, { ...po, items: insertedItems || [] }, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/purchase-orders/:id
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid PO ID')]),
  async (req, res) => {
    const { id } = req.params;
    const { items, ...bodyRest } = req.body;

    const allowedFields = ['date', 'site_id', 'retailer_id', 'status'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (bodyRest[f] !== undefined) updates[f] = bodyRest[f];
    });

    // If items are provided, recompute totals
    if (Array.isArray(items) && items.length > 0) {
      const computedItems = items.map(computeItemTotals);
      updates.base_amount = parseFloat(computedItems.reduce((s, i) => s + i.base_total, 0).toFixed(2));
      updates.gst_amount = parseFloat(computedItems.reduce((s, i) => s + i.gst_amount, 0).toFixed(2));
      updates.net_amount = parseFloat(Number(updates.base_amount + updates.gst_amount).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data: po, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .select('id, display_id, date, site_id, retailer_id, base_amount, gst_amount, net_amount, status, updated_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!po) return sendError(res, 'Purchase order not found', 404);

    // If items provided, replace them
    if (Array.isArray(items) && items.length > 0) {
      const { error: delError } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('order_id', id);

      if (delError) return sendError(res, delError.message, 500);

      const computedItems = items.map(computeItemTotals);
      const itemRows = items.map((item, idx) => {
        const computed = computedItems[idx];
        return {
          order_id: id,
          product_id: item.product_id || null,
          name: item.name,
          hsn: item.hsn || null,
          unit: item.unit || null,
          qty: computed.qty,
          price: computed.price,
          gst_percent: computed.gst_percent,
          gst_amount: computed.gst_amount,
          line_total: computed.line_total,
        };
      });

      const { data: newItems, error: insertError } = await supabase
        .from('purchase_order_items')
        .insert(itemRows)
        .select('id, order_id, product_id, name, hsn, unit, qty, price, gst_percent, gst_amount, line_total');

      if (insertError) return sendError(res, insertError.message, 400);

      return sendSuccess(res, { ...po, items: newItems || [] });
    }

    return sendSuccess(res, po);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/purchase-orders/:id
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('Invalid PO ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Purchase order not found', 404);
    return sendSuccess(res, { message: 'Purchase order deactivated', purchaseOrder: data });
  }
);

module.exports = router;
