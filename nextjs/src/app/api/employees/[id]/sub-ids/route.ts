import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  generateDisplayId,
  handleApiError,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/employees/:id/sub-ids
// List all sub-IDs for an employee.
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office', 'supervisor');
    if (roleCheck) return roleCheck;

    const { id } = await params;

    const { data, error } = await supabase
      .from('employee_sub_ids')
      .select('id, display_id, employee_id, site_id, rate, salary_basis, status, created_at')
      .eq('employee_id', id)
      .order('created_at', { ascending: false });

    if (error) return sendError(error.message, 500);

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/employees/:id/sub-ids
// Create a sub-ID record linked to an employee and site.
// Auto-generates display_id SUB-XXXX.
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office');
    if (roleCheck) return roleCheck;

    const { id: employee_id } = await params;
    const body = await request.json();
    const { site_id, rate, salary_basis } = body;

    // Validation
    if (!site_id) return sendError('site_id must be a valid UUID', 400);
    if (rate === undefined || isNaN(Number(rate))) return sendError('rate must be numeric', 400);
    if (!['Per Day', 'Monthly'].includes(salary_basis)) return sendError('salary_basis must be Per Day or Monthly', 400);

    // Verify employee exists
    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .single();

    if (empError || !emp) {
      return sendError('Employee not found', 404);
    }

    // Get next sequence for SUB display_id
    const { count } = await supabase
      .from('employee_sub_ids')
      .select('id', { count: 'exact', head: true });

    const seq = (count || 0) + 1;
    const display_id = generateDisplayId('SUB', seq);

    const { data, error } = await supabase
      .from('employee_sub_ids')
      .insert({
        display_id,
        employee_id,
        site_id,
        rate,
        salary_basis,
        status: 'active',
      })
      .select('id, display_id, employee_id, site_id, rate, salary_basis, status, created_at')
      .single();

    if (error) return sendError(error.message, 400);

    return sendSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
