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

// ---------------------------------------------------------------------------
// GET /api/approvals/logs - approval activity logs
// Admin only: returns activity_logs related to approvals.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const params = getSearchParams(request);
  const { module: moduleName, from, to } = params;

  let q = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (moduleName) q = q.eq('module', moduleName);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);

  return sendSuccess(data);
}
