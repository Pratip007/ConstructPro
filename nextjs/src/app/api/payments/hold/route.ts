import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// POST /api/payments/hold - put payments on hold
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { payment_ids } = body;

  if (!Array.isArray(payment_ids) || !payment_ids.length) {
    return sendError('payment_ids array is required', 400);
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'on_hold' })
    .in('id', payment_ids)
    .select();

  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}
