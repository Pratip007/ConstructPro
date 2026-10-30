import { NextResponse } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// GET /api/damaged-stocks
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { site_id, product_id } = getSearchParams(request);

  let q = supabase
    .from('damaged_stocks')
    .select('id, display_id, date, product_id, site_id, quantity, unit, reason, reported_by, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (site_id) q = q.eq('site_id', site_id);
  if (product_id) q = q.eq('product_id', product_id);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

// POST /api/damaged-stocks
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { date, productId, siteId, quantity, unit, reason } = body;

  if (!date) return sendError('date is required', 400);
  if (!productId) return sendError('productId must be a valid UUID', 400);
  if (!siteId) return sendError('siteId must be a valid UUID', 400);
  if (!quantity || Number(quantity) <= 0) return sendError('quantity must be a positive number', 400);
  if (!unit) return sendError('unit is required', 400);
  if (!reason) return sendError('reason is required', 400);

  const qty = parseFloat(Number(quantity).toFixed(3));

  // Reduce site inventory
  const { data: inv, error: invError } = await supabase
    .from('site_inventory')
    .select('id, quantity')
    .eq('product_id', productId)
    .eq('site_id', siteId)
    .maybeSingle();

  if (invError) return sendError(invError.message, 500);

  if (!inv) {
    return sendError('No inventory found for this product at the given site', 400);
  }

  const currentQty = parseFloat(Number(inv.quantity).toFixed(3));
  if (currentQty < qty) {
    return sendError('Insufficient stock to record damage', 400);
  }

  const newQty = parseFloat(Number(currentQty - qty).toFixed(3));
  const { error: updateError } = await supabase
    .from('site_inventory')
    .update({ quantity: newQty, last_updated: new Date().toISOString() })
    .eq('id', inv.id);

  if (updateError) return sendError(updateError.message, 500);

  // Count for display_id
  const { count, error: countError } = await supabase
    .from('damaged_stocks')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
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
      reported_by: auth.id,
      status: 'active',
    })
    .select('id, display_id, date, product_id, site_id, quantity, unit, reason, reported_by, status, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
