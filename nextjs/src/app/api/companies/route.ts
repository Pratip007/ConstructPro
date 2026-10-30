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
import { createApprovalRequest } from '@/lib/services/approvalEngine';

// GET /api/companies — list companies, filter by status. All roles.
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { status } = getSearchParams(request);

    let q = supabase
      .from('companies')
      .select('id, display_id, name, gst_number, state_code, phone, email, address, custom_fields, status, created_at, updated_at')
      .order('name');

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/companies — Admin: direct insert. Office: approval request. Supervisor: 403.
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin', 'office');
    if (roleError) return roleError;

    const body = await request.json();
    const { name, gst_number, state_code, phone, email, address, custom_fields } = body;

    if (!name) return sendError('name is required', 400);

    if (user.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('companies')
        .select('id', { count: 'exact', head: true });

      if (countError) return sendError(countError.message, 500);
      const display_id = generateDisplayId('COMP', (count || 0) + 1);

      const { data, error } = await supabase
        .from('companies')
        .insert({
          display_id,
          name,
          gst_number: gst_number || null,
          state_code: state_code || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          custom_fields: custom_fields || null,
          status: 'active',
        })
        .select('id, display_id, name, gst_number, state_code, phone, email, address, custom_fields, status, created_at')
        .single();

      if (error) return sendError(error.message, 400);
      return sendSuccess(data, 201);
    }

    // Office: create approval request
    const approval = await createApprovalRequest({
      source: 'office',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Company',
      actionType: 'new_entry',
      newData: {
        name,
        gst_number: gst_number || null,
        state_code: state_code || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        custom_fields: custom_fields || null,
      },
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return sendError(e.message || 'Approval request failed', e.status || 500);
  }
}
