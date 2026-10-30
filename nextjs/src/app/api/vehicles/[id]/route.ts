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

// PUT /api/vehicles/:id — Admin/office: update vehicle fields.
export async function PUT(
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

    const allowedFields = [
      'vehicle_number', 'vehicle_type', 'make', 'model', 'year',
      'owner_name', 'owner_contact', 'driver_name', 'fuel_type',
      'insurance_expiry', 'assigned_site_id', 'status',
    ];
    const updates: Record<string, unknown> = {};
    allowedFields.forEach((f) => {
      if (body[f] !== undefined) updates[f] = body[f];
    });
    if (updates.year !== undefined) updates.year = updates.year ? parseInt(String(updates.year), 10) : null;

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select('id, display_id, vehicle_number, vehicle_type, make, model, year, owner_name, owner_contact, assigned_site_id, status, updated_at')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Vehicle not found', 404);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/vehicles/:id — Admin only: soft delete (status -> 'inactive').
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin');
    if (roleError) return roleError;

    const { id } = await params;

    const { data, error } = await supabase
      .from('vehicles')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Vehicle not found', 404);
    return sendSuccess({ message: 'Vehicle deactivated', vehicle: data });
  } catch (error) {
    return handleApiError(error);
  }
}
