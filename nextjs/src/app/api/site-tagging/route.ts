import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  getSearchParams,
  handleApiError,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/site-tagging
// Returns site tagging log entries. Filterable by employee_id.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const params = getSearchParams(request);
    const { employee_id } = params;

    let q = supabase
      .from('site_tagging')
      .select('id, employee_id, site_id, tagged_at, tagged_by, created_at')
      .order('tagged_at', { ascending: false });

    if (employee_id) q = q.eq('employee_id', employee_id);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/site-tagging
// Body: { employeeId, siteId }
// Updates employee's current_site_id and creates a site_tagging log entry.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { employeeId, siteId } = body;

    // Validation
    if (!employeeId) return sendError('employeeId must be a valid UUID', 400);
    if (!siteId) return sendError('siteId must be a valid UUID', 400);

    // Update employee's current site
    const { error: updateError } = await supabase
      .from('employees')
      .update({ current_site_id: siteId })
      .eq('id', employeeId);

    if (updateError) {
      return sendError(updateError.message, 400);
    }

    // Create site_tagging log entry
    const { data, error } = await supabase
      .from('site_tagging')
      .insert({
        employee_id: employeeId,
        site_id: siteId,
        tagged_by: user.id,
        tagged_at: new Date().toISOString(),
      })
      .select('id, employee_id, site_id, tagged_at, tagged_by, created_at')
      .single();

    if (error) return sendError(error.message, 400);

    return sendSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
