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

// PUT /api/banks/:id — Admin only: update bank details.
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

    const allowedFields = ['bank_name', 'branch_name', 'account_number', 'ifsc_code', 'account_type', 'holder_name', 'opening_balance', 'status'];
    const updates: Record<string, unknown> = {};
    allowedFields.forEach((f) => {
      if (body[f] !== undefined) updates[f] = body[f];
    });

    if (updates.opening_balance !== undefined) {
      updates.opening_balance = parseFloat(Number(updates.opening_balance).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('banks')
      .update(updates)
      .eq('id', id)
      .select('id, bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance, status, updated_at')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Bank not found', 404);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/banks/:id — Admin only: soft delete (status -> 'inactive').
export async function DELETE(
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

    const { data, error } = await supabase
      .from('banks')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, bank_name, status')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Bank not found', 404);
    return sendSuccess({ message: 'Bank deactivated', bank: data });
  } catch (error) {
    return handleApiError(error);
  }
}
