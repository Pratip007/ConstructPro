import { NextResponse } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// GET /api/stock-transfers
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { from_site_id, to_site_id, status } = getSearchParams(request);

  let q = supabase
    .from('stock_transfers')
    .select('id, display_id, date, from_site_id, to_site_id, proof_url, status, remarks, created_by, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (from_site_id) q = q.eq('from_site_id', from_site_id);
  if (to_site_id) q = q.eq('to_site_id', to_site_id);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

// POST /api/stock-transfers
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { date, fromSiteId, toSiteId, items, remarks } = body;

  if (!date) return sendError('date is required', 400);
  if (!fromSiteId) return sendError('fromSiteId must be a valid UUID', 400);
  if (!toSiteId) return sendError('toSiteId must be a valid UUID', 400);
  if (!Array.isArray(items) || items.length === 0) return sendError('items must be a non-empty array', 400);

  if (fromSiteId === toSiteId) {
    return sendError('Source and destination sites must be different', 400);
  }

  // --- Validation pass: check all items have sufficient stock BEFORE any mutations ---
  const validatedItems: Array<{
    productId: string;
    qty: number;
    sourceInvId: string;
    currentQty: number;
    unit?: string;
    remarks?: string;
  }> = [];

  for (const item of items) {
    const qty = parseFloat(Number(item.qty).toFixed(3));

    const { data: sourceInv, error: srcError } = await supabase
      .from('site_inventory')
      .select('id, quantity')
      .eq('product_id', item.productId)
      .eq('site_id', fromSiteId)
      .maybeSingle();

    if (srcError) return sendError(srcError.message, 500);
    if (!sourceInv) {
      return sendError(`Insufficient stock for product ${item.productId}`, 400);
    }

    const currentQty = parseFloat(Number(sourceInv.quantity).toFixed(3));
    if (currentQty < qty) {
      return sendError(`Insufficient stock for product ${item.productId}: have ${currentQty}, need ${qty}`, 400);
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

    if (deductError) return sendError(deductError.message, 500);

    const { data: destInv, error: destFetchError } = await supabase
      .from('site_inventory')
      .select('id, quantity')
      .eq('product_id', vi.productId)
      .eq('site_id', toSiteId)
      .maybeSingle();

    if (destFetchError) return sendError(destFetchError.message, 500);

    if (destInv) {
      const newDestQty = parseFloat(
        Number(parseFloat(Number(destInv.quantity).toFixed(3)) + vi.qty).toFixed(3)
      );
      const { error: updateDestError } = await supabase
        .from('site_inventory')
        .update({ quantity: newDestQty, last_updated: new Date().toISOString() })
        .eq('id', destInv.id);

      if (updateDestError) return sendError(updateDestError.message, 500);
    } else {
      const { error: insertDestError } = await supabase
        .from('site_inventory')
        .insert({
          product_id: vi.productId,
          site_id: toSiteId,
          quantity: vi.qty,
          last_updated: new Date().toISOString(),
        });

      if (insertDestError) return sendError(insertDestError.message, 500);
    }
  }

  // Count for display_id
  const { count, error: countError } = await supabase
    .from('stock_transfers')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
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
      created_by: auth.id,
    })
    .select('id, display_id, date, from_site_id, to_site_id, status, remarks, created_by, created_at')
    .single();

  if (transferError) return sendError(transferError.message, 400);

  // Insert stock_transfer_items
  const itemRows = items.map((item: { productId: string; qty: number; unit?: string; remarks?: string }) => ({
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

  if (itemsError) return sendError(itemsError.message, 400);

  return sendSuccess({ ...transfer, items: insertedItems || [] }, 201);
}
