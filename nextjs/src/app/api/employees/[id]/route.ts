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
import { createApprovalRequest } from '@/lib/services/approvalEngine';

// ---------------------------------------------------------------------------
// PUT /api/employees/:id
// Admin: direct update. Office/Supervisor: approval request.
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office', 'supervisor');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const body = await request.json();
    const role = user.role;

    const allowedFields = [
      'name', 'phone', 'designation', 'working_positions',
      'category_id', 'current_site_id', 'status',
    ];

    const updates: Record<string, unknown> = {};
    allowedFields.forEach((f) => {
      if (body[f] !== undefined) updates[f] = body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select('id, display_id, name, phone, designation, working_positions, current_site_id, status, category_id, updated_at')
        .single();

      if (error) return sendError(error.message, 400);
      if (!data) return sendError('Employee not found', 404);

      return sendSuccess(data);
    }

    // Office/Supervisor: approval request
    const approval = await createApprovalRequest({
      source: role === 'office' ? 'office' : 'supervisor',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Employee',
      actionType: 'edit',
      referenceId: id,
      newData: updates,
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/employees/:id
// Admin only: soft delete (status -> 'inactive')
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin');
    if (roleCheck) return roleCheck;

    const { id } = await params;

    const { data, error } = await supabase
      .from('employees')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Employee not found', 404);

    return sendSuccess({ message: 'Employee deactivated', employee: data });
  } catch (error) {
    return handleApiError(error);
  }
}
