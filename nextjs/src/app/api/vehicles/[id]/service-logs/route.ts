import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  handleApiError,
} from '@/lib/api-utils';

// GET /api/vehicles/:id/service-logs — list service logs for a vehicle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const { data, error } = await supabase
      .from('vehicle_service_logs')
      .select('id, vehicle_id, service_date, service_type, description, cost, odometer_reading, next_service_date, serviced_by, remarks, created_at')
      .eq('vehicle_id', id)
      .order('service_date', { ascending: false });

    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/vehicles/:id/service-logs — add a service log entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin', 'office');
    if (roleError) return roleError;

    const { id } = await params;
    const body = await request.json();
    const {
      service_date, service_type, description,
      cost, odometer_reading, next_service_date,
      serviced_by, remarks,
    } = body;

    if (!service_date) return sendError('service_date is required', 400);
    if (!service_type) return sendError('service_type is required', 400);

    const { data, error } = await supabase
      .from('vehicle_service_logs')
      .insert({
        vehicle_id: id,
        service_date,
        service_type,
        description: description || null,
        cost: cost != null ? parseFloat(Number(cost).toFixed(2)) : null,
        odometer_reading: odometer_reading != null ? parseFloat(Number(odometer_reading).toFixed(2)) : null,
        next_service_date: next_service_date || null,
        serviced_by: serviced_by || null,
        remarks: remarks || null,
      })
      .select('id, vehicle_id, service_date, service_type, description, cost, odometer_reading, next_service_date, serviced_by, remarks, created_at')
      .single();

    if (error) return sendError(error.message, 400);
    return sendSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
