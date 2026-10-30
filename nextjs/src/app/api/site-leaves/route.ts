import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  enforceSiteLock,
  getSearchParams,
  handleApiError,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/site-leaves
// Supervisor: own site only. Filter: employee_id, site_id, date.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const params = getSearchParams(request);

    // enforceSiteLock: if supervisor, locks to their site
    const effectiveSiteId = enforceSiteLock(
      user,
      params.site_id ? params.site_id : null
    );

    let q = supabase
      .from('site_leaves')
      .select('id, employee_id, site_id, leave_date, reason, created_at')
      .order('leave_date', { ascending: false });

    if (params.employee_id) q = q.eq('employee_id', params.employee_id);
    if (effectiveSiteId) q = q.eq('site_id', effectiveSiteId);
    if (params.date) q = q.eq('leave_date', params.date);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/site-leaves
// Body: { date, employeeId, siteId, reason }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office', 'supervisor');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { date, employeeId, siteId, reason } = body;

    // enforceSiteLock for supervisors
    enforceSiteLock(user, siteId || null);

    // Validation
    if (!date) return sendError('date must be a valid ISO date', 400);
    if (!employeeId) return sendError('employeeId must be a valid UUID', 400);
    if (!siteId) return sendError('siteId must be a valid UUID', 400);

    const { data, error } = await supabase
      .from('site_leaves')
      .insert({
        employee_id: employeeId,
        site_id: siteId,
        leave_date: date,
        reason: reason || null,
      })
      .select('id, employee_id, site_id, leave_date, reason, created_at')
      .single();

    if (error) return sendError(error.message, 400);

    return sendSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
