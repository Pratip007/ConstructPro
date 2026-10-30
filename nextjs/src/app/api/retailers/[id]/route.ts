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

// PUT /api/retailers/:id — Admin: direct update. Office: approval request.
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

    const allowedFields = ['name', 'phone', 'address', 'gst_status', 'gst_number', 'site_id', 'category_id', 'status'];
    const updates: Record<string, unknown> = {};
    allowedFields.forEach((f) => {
      if (body[f] !== undefined) updates[f] = body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('retailers')
        .update(updates)
        .eq('id', id)
        .select('id, display_id, category_id, name, phone, address, gst_status, gst_number, site_id, status, updated_at')
        .single();

      if (error) return sendError(error.message, 400);
      if (!data) return sendError('Retailer not found', 404);
      return sendSuccess(data);
    }

    // Office: approval request
    const approval = await createApprovalRequest({
      source: 'office',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Retailer',
      actionType: 'edit',
      referenceId: id,
      newData: updates,
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return sendError(e.message || 'Approval request failed', e.status || 500);
  }
}

// DELETE /api/retailers/:id — Admin: soft delete. Office: approval request.
export async function DELETE(
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

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('retailers')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select('id, display_id, status')
        .single();

      if (error) return sendError(error.message, 400);
      if (!data) return sendError('Retailer not found', 404);
      return sendSuccess({ message: 'Retailer deactivated', retailer: data });
    }

    // Office: approval request
    const approval = await createApprovalRequest({
      source: 'office',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Retailer',
      actionType: 'delete',
      referenceId: id,
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return sendError(e.message || 'Approval request failed', e.status || 500);
  }
}
