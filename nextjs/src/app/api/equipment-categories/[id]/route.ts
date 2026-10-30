import { NextResponse } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// PUT /api/equipment-categories/:id
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin');
  if (roleCheck) return roleCheck;

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
    .from('equipment_categories')
    .update(updates)
    .eq('id', id)
    .select('id, name, description, status, updated_at')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Category not found', 404);
  return sendSuccess(data);
}

// DELETE /api/equipment-categories/:id
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('equipment_categories')
    .update({ status: 'inactive' })
    .eq('id', id)
    .select('id, name, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Category not found', 404);
  return sendSuccess({ message: 'Category deactivated', category: data });
}
