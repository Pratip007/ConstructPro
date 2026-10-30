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

// PUT /api/retailer-categories/:id — admin only: update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin');
    if (roleError) return roleError;

    const { id } = await params;
    const body = await request.json();

    const allowedFields = ['name', 'description', 'status'];
    const updates: Record<string, unknown> = {};
    allowedFields.forEach((f) => {
      if (body[f] !== undefined) updates[f] = body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('retailer_categories')
      .update(updates)
      .eq('id', id)
      .select('id, name, description, status, updated_at')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Category not found', 404);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
