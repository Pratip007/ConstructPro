import { NextResponse } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// GET /api/equipment
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { status, category_id } = getSearchParams(request);

  let q = supabase
    .from('equipment_parties')
    .select('id, display_id, name, contact, address, category_id, status, created_at, updated_at')
    .order('name');

  if (status) q = q.eq('status', status);
  if (category_id) q = q.eq('category_id', category_id);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

// POST /api/equipment
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { name, contact, address, category_id } = body;

  if (!name) return sendError('name is required', 400);

  const { count, error: countError } = await supabase
    .from('equipment_parties')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
  const display_id = generateDisplayId('EQP', (count || 0) + 1);

  const { data, error } = await supabase
    .from('equipment_parties')
    .insert({
      display_id,
      name,
      contact: contact || null,
      address: address || null,
      category_id: category_id || null,
      status: 'active',
    })
    .select('id, display_id, name, contact, address, category_id, status, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
