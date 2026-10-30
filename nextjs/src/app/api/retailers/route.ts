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
  enforceSiteLock,
  handleApiError,
} from '@/lib/api-utils';
import { createApprovalRequest } from '@/lib/services/approvalEngine';

// GET /api/retailers — all roles can view. Supervisor: site-locked.
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const { status, site_id, category_id } = getSearchParams(request);

    // Enforce site lock for supervisors
    const effectiveSiteId = enforceSiteLock(user, site_id ? Number(site_id) : null);

    let q = supabase
      .from('retailers')
      .select('id, display_id, category_id, name, phone, address, gst_status, gst_number, site_id, status, created_at, updated_at')
      .order('name');

    if (effectiveSiteId) q = q.eq('site_id', effectiveSiteId);
    else if (site_id) q = q.eq('site_id', site_id);
    if (status) q = q.eq('status', status);
    if (category_id) q = q.eq('category_id', category_id);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/retailers — Admin: direct insert. Office: approval request.
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin', 'office');
    if (roleError) return roleError;

    const body = await request.json();
    const { name, phone, address, gst_status, gst_number, site_id, category_id } = body;

    if (!name) return sendError('name is required', 400);

    if (user.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('retailers')
        .select('id', { count: 'exact', head: true });

      if (countError) return sendError(countError.message, 500);
      const display_id = generateDisplayId('RET', (count || 0) + 1);

      const { data, error } = await supabase
        .from('retailers')
        .insert({
          display_id,
          name,
          phone: phone || null,
          address: address || null,
          gst_status: gst_status || 'NO',
          gst_number: gst_number || null,
          site_id: site_id || null,
          category_id: category_id || null,
          status: 'active',
        })
        .select('id, display_id, category_id, name, phone, address, gst_status, gst_number, site_id, status, created_at')
        .single();

      if (error) return sendError(error.message, 400);
      return sendSuccess(data, 201);
    }

    // Office: create approval request
    const approval = await createApprovalRequest({
      source: 'office',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Retailer',
      actionType: 'new_entry',
      newData: {
        name,
        phone: phone || null,
        address: address || null,
        gst_status: gst_status || 'NO',
        gst_number: gst_number || null,
        site_id: site_id || null,
        category_id: category_id || null,
      },
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return sendError(e.message || 'Approval request failed', e.status || 500);
  }
}
