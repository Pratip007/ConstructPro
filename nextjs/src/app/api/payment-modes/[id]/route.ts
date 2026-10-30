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
// GET /api/payment-modes/:id - get single payment mode
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const { id } = await params;

    const { data, error } = await supabase
      .from('payment_modes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return sendError(error.message, 500);
    if (!data) return sendError('Payment mode not found', 404);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/payment-modes/:id - update payment mode (admin only)
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('payment_modes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Payment mode not found', 404);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/payment-modes/:id - delete payment mode (admin only)
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

    const { data, error } = await supabase
      .from('payment_modes')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Payment mode not found', 404);
    return sendSuccess({ message: 'Payment mode deleted', paymentMode: data });
  } catch (error) {
    return handleApiError(error);
  }
}
