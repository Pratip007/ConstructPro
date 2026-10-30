import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  const allowedFields = ['title', 'content', 'module', 'status'];
  const updates: Record<string, unknown> = {};
  allowedFields.forEach((f) => {
    if (body[f] !== undefined) updates[f] = body[f];
  });

  if (Object.keys(updates).length === 0) {
    return sendError('No fields to update', 400);
  }

  const { data, error } = await supabase
    .from('terms_conditions')
    .update(updates)
    .eq('id', id)
    .select('id, title, content, module, status, updated_at')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Terms & Conditions record not found', 404);
  return sendSuccess(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('terms_conditions')
    .update({ status: 'inactive' })
    .eq('id', id)
    .select('id, title, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Terms & Conditions record not found', 404);
  return sendSuccess({ message: 'Terms & Conditions deactivated', terms: data });
}
