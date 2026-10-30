import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  const allowedFields = ['date', 'type', 'bank_account', 'purpose', 'particulars', 'remark', 'status'];
  const updates: Record<string, unknown> = {};
  allowedFields.forEach((f) => {
    if (body[f] !== undefined) updates[f] = body[f];
  });

  // Handle amount separately for precision rounding
  if (body.amount !== undefined) {
    updates.amount = parseFloat(Number(body.amount).toFixed(2));
  }

  if (Object.keys(updates).length === 0) {
    return sendError('No fields to update', 400);
  }

  const { data, error } = await supabase
    .from('income_expenses')
    .update(updates)
    .eq('id', id)
    .select('id, date, type, bank_account, purpose, particulars, remark, amount, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Income/expense entry not found', 404);
  return sendSuccess(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('income_expenses')
    .update({ status: 'inactive' })
    .eq('id', id)
    .select('id, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Income/expense entry not found', 404);
  return sendSuccess({ message: 'Entry deactivated', entry: data });
}
