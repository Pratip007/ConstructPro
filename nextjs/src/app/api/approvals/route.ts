import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  getSearchParams,
} from '@/lib/api-utils';
import { createApprovalRequest } from '@/lib/services/approvalEngine';

// ---------------------------------------------------------------------------
// GET /api/approvals - list approval requests
// Admin: all requests. Office/supervisor: own requests only.
// Query params: status, source, module
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const params = getSearchParams(request);
  const { status, source, module: moduleName } = params;
  const role = user.role;

  let q = supabase
    .from('approval_requests')
    .select('*')
    .order('created_at', { ascending: false });

  // Non-admin users only see their own requests
  if (role !== 'admin') {
    q = q.eq('requester_id', user.id);
  }

  if (status) q = q.eq('status', status);
  if (source) q = q.eq('source', source);
  if (moduleName) q = q.eq('module', moduleName);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);

  return sendSuccess(data);
}

// ---------------------------------------------------------------------------
// POST /api/approvals - office/supervisor submits an approval request
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'office', 'supervisor');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const {
    source,
    module: moduleName,
    action_type,
    reference_id,
    amount,
    old_data,
    new_data,
    reason,
    site_id,
  } = body;

  // Validation
  if (!['office', 'supervisor'].includes(source)) return sendError('source must be office or supervisor', 400);
  if (!moduleName) return sendError('module is required', 400);
  if (!['new_entry', 'edit', 'delete', 'status_toggle'].includes(action_type)) {
    return sendError('action_type must be one of: new_entry, edit, delete, status_toggle', 400);
  }

  try {
    const approvalRequest = await createApprovalRequest({
      source,
      requesterId: user.id,
      requesterName: user.name,
      siteId: site_id || user.siteId || null,
      module: moduleName,
      actionType: action_type,
      referenceId: reference_id || null,
      amount: amount || null,
      oldData: old_data || null,
      newData: new_data || null,
      reason: reason || null,
    });
    return sendSuccess(approvalRequest, 201);
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return sendError(error.message || 'Failed to create approval request', error.status || 500);
  }
}
