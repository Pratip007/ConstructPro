import { NextResponse } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// GET /api/stock-products
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { category, status } = getSearchParams(request);

  let q = supabase
    .from('stock_products')
    .select('id, display_id, name, unit, hsn, category, gst_percent, status, created_at, updated_at')
    .order('name');

  if (category) q = q.eq('category', category);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

// POST /api/stock-products
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { name, unit, hsn, category, gst_percent } = body;

  if (!name) return sendError('name is required', 400);
  if (!unit) return sendError('unit is required', 400);

  const { count, error: countError } = await supabase
    .from('stock_products')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
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

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
