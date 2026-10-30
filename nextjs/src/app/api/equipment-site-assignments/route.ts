import { NextResponse } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// GET /api/equipment-site-assignments
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { equipment_party_id, site_id, status } = getSearchParams(request);

  let q = supabase
    .from('equipment_site_assignments')
    .select('id, display_id, equipment_party_id, site_id, assigned_date, released_date, rate, rate_unit, status, remarks, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (equipment_party_id) q = q.eq('equipment_party_id', equipment_party_id);
  if (site_id) q = q.eq('site_id', site_id);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

// POST /api/equipment-site-assignments
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { equipment_party_id, site_id, assigned_date, released_date, rate, rate_unit, remarks } = body;

  if (!equipment_party_id) return sendError('equipment_party_id must be a valid UUID', 400);
  if (!site_id) return sendError('site_id must be a valid UUID', 400);
  if (!assigned_date) return sendError('assigned_date is required', 400);

  const { count, error: countError } = await supabase
    .from('equipment_site_assignments')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
  const display_id = generateDisplayId('ESA', (count || 0) + 1);

  const { data, error } = await supabase
    .from('equipment_site_assignments')
    .insert({
      display_id,
      equipment_party_id,
      site_id,
      assigned_date,
      released_date: released_date || null,
      rate: rate != null ? parseFloat(Number(rate).toFixed(2)) : null,
      rate_unit: rate_unit || null,
      status: 'active',
      remarks: remarks || null,
    })
    .select('id, display_id, equipment_party_id, site_id, assigned_date, released_date, rate, rate_unit, status, remarks, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
