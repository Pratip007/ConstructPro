import { NextResponse } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// PUT /api/equipment/:id
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  const allowedFields = ['name', 'contact', 'address', 'category_id', 'status'];
  const updates: Record<string, unknown> = {};
  allowedFields.forEach((f) => {
    if (body[f] !== undefined) updates[f] = body[f];
  });

  if (Object.keys(updates).length === 0) {
    return sendError('No fields to update', 400);
  }

  const { data, error } = await supabase
    .from('equipment_parties')
    .update(updates)
    .eq('id', id)
    .select('id, display_id, name, contact, address, category_id, status, updated_at')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Equipment not found', 404);
  return sendSuccess(data);
}

// DELETE /api/equipment/:id
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('equipment_parties')
    .update({ status: 'inactive' })
    .eq('id', id)
    .select('id, display_id, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Equipment not found', 404);
  return sendSuccess({ message: 'Equipment deactivated', equipment: data });
}
