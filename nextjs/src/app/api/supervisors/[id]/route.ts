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

// PUT /api/supervisors/:id — admin only: update supervisor fields, optionally reassign site.
export async function PUT(
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
    const body = await request.json();
    const { name, contact, address, employee_id, siteId, status } = body;

    const supervisorUpdates: Record<string, unknown> = {};
    if (name !== undefined) supervisorUpdates.name = name;
    if (contact !== undefined) supervisorUpdates.contact = contact;
    if (address !== undefined) supervisorUpdates.address = address;
    if (employee_id !== undefined) supervisorUpdates.employee_id = employee_id;
    if (siteId !== undefined) supervisorUpdates.assigned_site_id = siteId;
    if (status !== undefined) supervisorUpdates.status = status;

    if (Object.keys(supervisorUpdates).length === 0) {
      return sendError('No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('supervisors')
      .update(supervisorUpdates)
      .eq('id', id)
      .select('id, display_id, name, contact, address, employee_id, profile_id, assigned_site_id, status')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Supervisor not found', 404);

    // If site is being reassigned, update the linked profile's site_id too
    if (siteId !== undefined && data.profile_id) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ assigned_site_id: siteId })
        .eq('id', data.profile_id);

      if (profileUpdateError) {
        return sendError(`Supervisor updated but profile site sync failed: ${profileUpdateError.message}`, 500);
      }
    }

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/supervisors/:id — admin only: soft delete (status -> 'inactive').
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
      .from('supervisors')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Supervisor not found', 404);
    return sendSuccess({ message: 'Supervisor deactivated', supervisor: data });
  } catch (error) {
    return handleApiError(error);
  }
}
