/**
 * Stock routes
 *
 * Stock Products (/api/stock-products):
 * GET    /   — list all, filter by category, status
 * POST   /   — create. Admin/office only. Display_id prefix: SP
 *
 * Site Inventory (/api/site-inventory):
 * GET    /   — filter by site_id, product_id. Supervisor: auto-filtered via sitelock
 *
 * Stock Transfers (/api/stock-transfers):
 * GET    /   — list, filter by from_site_id, to_site_id, status
 * POST   /   — create transfer with inventory check. Display_id prefix: STR
 *
 * Damaged Stocks (/api/damaged-stocks):
 * GET    /   — list, filter by site_id, product_id
 * POST   /   — record damage, reduces inventory. Display_id prefix: DMG
 */

const express = require('express');
const { body } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { enforceSiteLock } = require('../middleware/sitelock');
const { validate } = require('../middleware/validate');

// ---------------------------------------------------------------------------
// Stock Products Router
// ---------------------------------------------------------------------------
const stockProductsRouter = express.Router();
stockProductsRouter.use(authenticateToken);

// GET /api/stock-products
stockProductsRouter.get('/', async (req, res) => {
  const { category, status } = req.query;

  let q = supabase
    .from('stock_products')
    .select('id, display_id, name, unit, hsn, category, gst_percent, status, created_at, updated_at')
    .order('name');

  if (category) q = q.eq('category', category);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/stock-products
stockProductsRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('unit').notEmpty().withMessage('unit is required'),
    body('gst_percent').optional().isNumeric().withMessage('gst_percent must be numeric'),
  ]),
  async (req, res) => {
    const { name, unit, hsn, category, gst_percent } = req.body;

    const { count, error: countError } = await supabase
      .from('stock_products')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('SP', (count || 0) + 1);

    const { data, error } = await supabase
      .from('stock_products')
      .insert({
        display_id,
        name,
        unit,
        hsn: hsn || null,
        category: category || null,
        gst_percent: gst_percent != null ? parseFloat(Number(gst_percent).toFixed(2)) : null,
        status: 'active',
      })
      .select('id, display_id, name, unit, hsn, category, gst_percent, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// ---------------------------------------------------------------------------
// Site Inventory Router
// ---------------------------------------------------------------------------
const siteInventoryRouter = express.Router();
siteInventoryRouter.use(authenticateToken);

// GET /api/site-inventory
siteInventoryRouter.get('/', enforceSiteLock, async (req, res) => {
  const { site_id, product_id } = req.query;

  let q = supabase
    .from('site_inventory')
    .select('id, product_id, site_id, quantity, last_updated, created_at, updated_at')
    .order('last_updated', { ascending: false });

  if (site_id) q = q.eq('site_id', site_id);
  if (product_id) q = q.eq('product_id', product_id);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// Stock Transfers Router
// ---------------------------------------------------------------------------
const stockTransfersRouter = express.Router();
stockTransfersRouter.use(authenticateToken);

// GET /api/stock-transfers
stockTransfersRouter.get('/', async (req, res) => {
  const { from_site_id, to_site_id, status } = req.query;

  let q = supabase
    .from('stock_transfers')
    .select('id, display_id, date, from_site_id, to_site_id, proof_url, status, remarks, created_by, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (from_site_id) q = q.eq('from_site_id', from_site_id);
  if (to_site_id) q = q.eq('to_site_id', to_site_id);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/stock-transfers
stockTransfersRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('date').notEmpty().withMessage('date is required'),
    body('fromSiteId').isUUID().withMessage('fromSiteId must be a valid UUID'),
    body('toSiteId').isUUID().withMessage('toSiteId must be a valid UUID'),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.productId').isUUID().withMessage('Each item productId must be a valid UUID'),
    body('items.*.qty').isFloat({ gt: 0 }).withMessage('Each item qty must be a positive number'),
  ]),
  async (req, res) => {
    const { date, fromSiteId, toSiteId, items, remarks } = req.body;

    if (fromSiteId === toSiteId) {
      return sendError(res, 'Source and destination sites must be different', 400);
    }

    // --- Validation pass: check all items have sufficient stock BEFORE any mutations ---
    const validatedItems = [];
    for (const item of items) {
      const qty = parseFloat(Number(item.qty).toFixed(3));

      const { data: sourceInv, error: srcError } = await supabase
        .from('site_inventory')
        .select('id, quantity')
        .eq('product_id', item.productId)
        .eq('site_id', fromSiteId)
        .maybeSingle();

      if (srcError) return sendError(res, srcError.message, 500);
      if (!sourceInv) {
        return sendError(res, `Insufficient stock for product ${item.productId}`, 400);
      }

      const currentQty = parseFloat(Number(sourceInv.quantity).toFixed(3));
      if (currentQty < qty) {
        return sendError(res, `Insufficient stock for product ${item.productId}: have ${currentQty}, need ${qty}`, 400);
      }

      validatedItems.push({ ...item, qty, sourceInvId: sourceInv.id, currentQty });
    }

    // --- Mutation pass: all items validated, now apply changes ---
    for (const vi of validatedItems) {
      const newSourceQty = parseFloat(Number(vi.currentQty - vi.qty).toFixed(3));
      const { error: deductError } = await supabase
        .from('site_inventory')
        .update({ quantity: newSourceQty, last_updated: new Date().toISOString() })
        .eq('id', vi.sourceInvId);

      if (deductError) return sendError(res, deductError.message, 500);

      const { data: destInv, error: destFetchError } = await supabase
        .from('site_inventory')
        .select('id, quantity')
        .eq('product_id', vi.productId)
        .eq('site_id', toSiteId)
        .maybeSingle();

      if (destFetchError) return sendError(res, destFetchError.message, 500);

      if (destInv) {
        const newDestQty = parseFloat(
          Number(parseFloat(Number(destInv.quantity).toFixed(3)) + vi.qty).toFixed(3)
        );
        const { error: updateDestError } = await supabase
          .from('site_inventory')
          .update({ quantity: newDestQty, last_updated: new Date().toISOString() })
          .eq('id', destInv.id);

        if (updateDestError) return sendError(res, updateDestError.message, 500);
      } else {
        const { error: insertDestError } = await supabase
          .from('site_inventory')
          .insert({
            product_id: vi.productId,
            site_id: toSiteId,
            quantity: vi.qty,
            last_updated: new Date().toISOString(),
          });

        if (insertDestError) return sendError(res, insertDestError.message, 500);
      }
    }

    // Count for display_id
    const { count, error: countError } = await supabase
      .from('stock_transfers')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('STR', (count || 0) + 1);

    // Insert stock_transfers header
    const { data: transfer, error: transferError } = await supabase
      .from('stock_transfers')
      .insert({
        display_id,
        date,
        from_site_id: fromSiteId,
        to_site_id: toSiteId,
        remarks: remarks || null,
        status: 'active',
        created_by: req.user.id,
      })
      .select('id, display_id, date, from_site_id, to_site_id, status, remarks, created_by, created_at')
      .single();

    if (transferError) return sendError(res, transferError.message, 400);

    // Insert stock_transfer_items
    const itemRows = items.map((item) => ({
      transfer_id: transfer.id,
      product_id: item.productId,
      quantity: parseFloat(Number(item.qty).toFixed(3)),
      unit: item.unit || null,
      remarks: item.remarks || null,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('stock_transfer_items')
      .insert(itemRows)
      .select('id, transfer_id, product_id, quantity, unit, remarks');

    if (itemsError) return sendError(res, itemsError.message, 400);

    return sendSuccess(res, { ...transfer, items: insertedItems || [] }, 201);
  }
);

// ---------------------------------------------------------------------------
// Damaged Stocks Router
// ---------------------------------------------------------------------------
const damagedStocksRouter = express.Router();
damagedStocksRouter.use(authenticateToken);

// GET /api/damaged-stocks
damagedStocksRouter.get('/', async (req, res) => {
  const { site_id, product_id } = req.query;

  let q = supabase
    .from('damaged_stocks')
    .select('id, display_id, date, product_id, site_id, quantity, unit, reason, reported_by, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (site_id) q = q.eq('site_id', site_id);
  if (product_id) q = q.eq('product_id', product_id);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/damaged-stocks
damagedStocksRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('date').notEmpty().withMessage('date is required'),
    body('productId').isUUID().withMessage('productId must be a valid UUID'),
    body('siteId').isUUID().withMessage('siteId must be a valid UUID'),
    body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be a positive number'),
    body('unit').notEmpty().withMessage('unit is required'),
    body('reason').notEmpty().withMessage('reason is required'),
  ]),
  async (req, res) => {
    const { date, productId, siteId, quantity, unit, reason } = req.body;
    const qty = parseFloat(Number(quantity).toFixed(3));

    // Reduce site inventory
    const { data: inv, error: invError } = await supabase
      .from('site_inventory')
      .select('id, quantity')
      .eq('product_id', productId)
      .eq('site_id', siteId)
      .maybeSingle();

    if (invError) return sendError(res, invError.message, 500);

    if (!inv) {
      return sendError(res, 'No inventory found for this product at the given site', 400);
    }

    const currentQty = parseFloat(Number(inv.quantity).toFixed(3));
    if (currentQty < qty) {
      return sendError(res, 'Insufficient stock to record damage', 400);
    }

    const newQty = parseFloat(Number(currentQty - qty).toFixed(3));
    const { error: updateError } = await supabase
      .from('site_inventory')
      .update({ quantity: newQty, last_updated: new Date().toISOString() })
      .eq('id', inv.id);

    if (updateError) return sendError(res, updateError.message, 500);

    // Count for display_id
    const { count, error: countError } = await supabase
      .from('damaged_stocks')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('DMG', (count || 0) + 1);

    // Insert damaged_stocks record
    const { data, error } = await supabase
      .from('damaged_stocks')
      .insert({
        display_id,
        date,
        product_id: productId,
        site_id: siteId,
        quantity: qty,
        unit,
        reason,
        reported_by: req.user.id,
        status: 'active',
      })
      .select('id, display_id, date, product_id, site_id, quantity, unit, reason, reported_by, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

module.exports = {
  stockProductsRouter,
  siteInventoryRouter,
  stockTransfersRouter,
  damagedStocksRouter,
};
