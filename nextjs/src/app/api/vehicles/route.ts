import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  getSearchParams,
  generateDisplayId,
  handleApiError,
} from '@/lib/api-utils';

// GET /api/vehicles — list all, filter by status, assigned_site_id
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { status, assigned_site_id } = getSearchParams(request);

    let q = supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);
    if (assigned_site_id) q = q.eq('assigned_site_id', assigned_site_id);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/vehicles — Admin only. Display_id prefix: VEH
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin');
    if (roleError) return roleError;

    const body = await request.json();
    const {
      vehicle_number, vehicle_type, make, model, year,
      owner_name, owner_contact, driver_name, fuel_type,
      insurance_expiry, assigned_site_id,
    } = body;

    if (!vehicle_number) return sendError('vehicle_number is required', 400);
    if (!vehicle_type) return sendError('vehicle_type is required', 400);

    const { count, error: countError } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(countError.message, 500);
    const display_id = generateDisplayId('VEH', (count || 0) + 1);

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        display_id,
        vehicle_number,
        vehicle_type,
        make: make || null,
        model: model || null,
        year: year ? parseInt(year, 10) : null,
        owner_name: owner_name || null,
        owner_contact: owner_contact || null,
        driver_name: driver_name || null,
        fuel_type: fuel_type || null,
        insurance_expiry: insurance_expiry || null,
        assigned_site_id: assigned_site_id || null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) return sendError(error.message, 400);
    return sendSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
