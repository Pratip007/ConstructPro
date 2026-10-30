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

// GET /api/retailer-categories — list all categories. All authenticated users.
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { data, error } = await supabase
      .from('retailer_categories')
      .select('id, name, description, status, created_at, updated_at')
      .order('name');

    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/retailer-categories — create category (admin/office)
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin', 'office');
    if (roleError) return roleError;

    const body = await request.json();
    const { name, description } = body;

    if (!name) return sendError('name is required', 400);

    const { data, error } = await supabase
      .from('retailer_categories')
      .insert({
        name,
        description: description || null,
        status: 'active',
      })
      .select('id, name, description, status, created_at')
      .single();

    if (error) return sendError(error.message, 400);
    return sendSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
