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

// GET /api/sites — list sites, filter by company_id, status. All roles.
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { company_id, status } = getSearchParams(request);

    let q = supabase
      .from('sites')
      .select('id, display_id, name, company_id, address, status, created_at, updated_at')
      .order('name');

    if (company_id) q = q.eq('company_id', company_id);
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/sites — Admin: direct insert. Office: approval request.
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin', 'office');
    if (roleError) return roleError;

    const body = await request.json();
    const { name, company_id, address, status } = body;

    if (!name) return sendError('name is required', 400);

    if (user.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('sites')
        .select('id', { count: 'exact', head: true });

      if (countError) return sendError(countError.message, 500);
      const display_id = generateDisplayId('SITE', (count || 0) + 1);

      const { data, error } = await supabase
        .from('sites')
        .insert({
          display_id,
          name,
          company_id,
          address: address || null,
          status: status || 'active',
        })
        .select('id, display_id, name, company_id, address, status, created_at')
        .single();

      if (error) return sendError(error.message, 400);
      return sendSuccess(data, 201);
    }

    // Office: create approval request
    const approval = await createApprovalRequest({
      source: 'office',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Site',
      actionType: 'new_entry',
      newData: {
        name,
        company_id,
        address: address || null,
        status: status || 'active',
      },
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return sendError(e.message || 'Approval request failed', e.status || 500);
  }
}
