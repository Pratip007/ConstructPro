import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  handleApiError,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/employee-categories
// Returns all employee categories (position types).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const { data, error } = await supabase
      .from('employee_categories')
      .select('id, display_id, name, working_days, created_at, updated_at')
      .order('name');

    if (error) {
      return sendError(error.message, 500);
    }

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/employee-categories
// Admin/office only: create a new category.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { name, working_days } = body;

    // Validation
    if (!name) return sendError('Name is required', 400);
    if (working_days !== undefined) {
      const wd = Number(working_days);
      if (!Number.isInteger(wd) || wd < 1 || wd > 31) {
        return sendError('working_days must be between 1 and 31', 400);
      }
    }

    // Get next sequence for display_id
    const { count } = await supabase
      .from('employee_categories')
      .select('id', { count: 'exact', head: true });

    const seq = (count || 0) + 1;
    const display_id = `CAT-${String(seq).padStart(3, '0')}`;

    const { data, error } = await supabase
      .from('employee_categories')
      .insert({ display_id, name, working_days: working_days || null })
      .select('id, display_id, name, working_days, created_at')
      .single();

    if (error) {
      return sendError(error.message, 400);
    }

    return sendSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
