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

// GET /api/contractors — list contractors (filter: status, category). All roles.
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { status, category } = getSearchParams(request);

    let q = supabase
      .from('contractors')
      .select('id, display_id, name, phone, email, pan, gst_number, category, address, tds_applicable, tds_percent, avatar_url, status, created_at, updated_at')
      .order('name');

    if (status) q = q.eq('status', status);
    if (category) q = q.eq('category', category);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/contractors — create contractor. Admin: direct. Office: approval.
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin', 'office');
    if (roleError) return roleError;

    const body = await request.json();
    const {
      name, phone, email, pan, gst_number, category,
      address, tds_applicable, tds_percent, avatar_url,
    } = body;

    if (!name) return sendError('name is required', 400);

    if (user.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('contractors')
        .select('id', { count: 'exact', head: true });

      if (countError) return sendError(countError.message, 500);
      const display_id = generateDisplayId('CON', (count || 0) + 1);

      const { data, error } = await supabase
        .from('contractors')
        .insert({
          display_id,
          name,
          phone: phone || null,
          email: email || null,
          pan: pan || null,
          gst_number: gst_number || null,
          category: category || null,
          address: address || null,
          tds_applicable: tds_applicable || false,
          tds_percent: tds_percent != null ? parseFloat(Number(tds_percent).toFixed(2)) : null,
          avatar_url: avatar_url || null,
          status: 'active',
        })
        .select('id, display_id, name, phone, email, pan, gst_number, category, address, tds_applicable, tds_percent, avatar_url, status, created_at')
        .single();

      if (error) return sendError(error.message, 400);
      return sendSuccess(data, 201);
    }

    // Office: create approval request
    const approval = await createApprovalRequest({
      source: 'office',
      requesterId: user.id,
      requesterName: user.name,
      module: 'Contractor',
      actionType: 'new_entry',
      newData: {
        name,
        phone: phone || null,
        email: email || null,
        pan: pan || null,
        gst_number: gst_number || null,
        category: category || null,
        address: address || null,
        tds_applicable: tds_applicable || false,
        tds_percent: tds_percent != null ? parseFloat(Number(tds_percent).toFixed(2)) : null,
        avatar_url: avatar_url || null,
      },
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return sendError(e.message || 'Approval request failed', e.status || 500);
  }
}
