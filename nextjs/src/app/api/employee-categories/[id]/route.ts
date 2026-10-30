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
// PUT /api/employee-categories/:id
// Admin/office only: update a category.
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.working_days !== undefined) updates.working_days = body.working_days;

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    // Validation
    if (body.name !== undefined && !body.name) {
      return sendError('Name cannot be empty', 400);
    }
    if (body.working_days !== undefined) {
      const wd = Number(body.working_days);
      if (!Number.isInteger(wd) || wd < 1 || wd > 31) {
        return sendError('working_days must be between 1 and 31', 400);
      }
    }

    const { data, error } = await supabase
      .from('employee_categories')
      .update(updates)
      .eq('id', id)
      .select('id, display_id, name, working_days, updated_at')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Category not found', 404);

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/employee-categories/:id
// Admin only: delete a category.
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin');
    if (roleCheck) return roleCheck;

    const { id } = await params;

    const { error } = await supabase
      .from('employee_categories')
      .delete()
      .eq('id', id);

    if (error) return sendError(error.message, 400);

    return sendSuccess({ message: 'Category deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}
