import { NextRequest } from 'next/server';
import { supabase, supabaseAnon } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  handleApiError,
} from '@/lib/api-utils';
import { createApprovalRequest } from '@/lib/services/approvalEngine';

// PUT /api/contractors/:id — update contractor. Admin: direct. Office: approval.
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

    const allowedFields = ['name', 'phone', 'email', 'pan', 'gst_number', 'category', 'address', 'tds_applicable', 'tds_percent', 'avatar_url', 'status'];
    const updates: Record<string, unknown> = {};
    allowedFields.forEach((f) => {
      if (body[f] !== undefined) updates[f] = body[f];
    });

    if (updates.tds_percent !== undefined) {
      updates.tds_percent = parseFloat(Number(updates.tds_percent).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('contractors')
        .update(updates)
        .eq('id', id)
        .select('id, display_id, name, phone, email, pan, gst_number, category, address, tds_applicable, tds_percent, avatar_url, status, updated_at')
        .single();

      if (error) return sendError(error.message, 400);
      if (!data) return sendError('Contractor not found', 404);
      return sendSuccess(data);
    }

    // Office: approval request
    const approval = await createApprovalRequest({
      source: 'office',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Contractor',
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

// DELETE /api/contractors/:id — soft delete. Admin: password-confirmed. Office: approval.
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
      let body: Record<string, unknown> = {};
      try {
        body = await request.json();
      } catch {
        // no body
      }
      const { password } = body;

      if (!password) {
        return sendError('Password confirmation required for delete', 400);
      }

      // Look up the admin's email from Supabase Auth
      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(user.authUid);
      if (authUserError || !authUserData?.user?.email) {
        return sendError('Could not retrieve admin credentials', 500);
      }

      const adminEmail = authUserData.user.email;

      // Verify admin password using anon client to avoid corrupting service-role session
      const { error: authError } = await supabaseAnon.auth.signInWithPassword({
        email: adminEmail,
        password: password as string,
      });

      if (authError) {
        return sendError('Password verification failed', 403);
      }

      // Soft delete: status -> 'inactive'
      const { data, error } = await supabase
        .from('contractors')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select('id, display_id, status')
        .single();

      if (error) return sendError(error.message, 400);
      if (!data) return sendError('Contractor not found', 404);
      return sendSuccess({ message: 'Contractor deactivated', contractor: data });
    }

    // Office: approval request
    const approval = await createApprovalRequest({
      source: 'office',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Contractor',
      actionType: 'delete',
      referenceId: id,
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return sendError(e.message || 'Approval request failed', e.status || 500);
  }
}
