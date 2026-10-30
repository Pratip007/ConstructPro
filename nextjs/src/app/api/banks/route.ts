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

// GET /api/banks — list all active banks. All authenticated roles.
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { data, error } = await supabase
      .from('banks')
      .select('id, bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance, status, created_at, updated_at')
      .eq('status', 'active')
      .order('bank_name');

    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/banks — Admin only: create a new bank.
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin');
    if (roleError) return roleError;

    const body = await request.json();
    const { bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance } = body;

    if (!bank_name) return sendError('bank_name is required', 400);
    if (!account_number) return sendError('account_number is required', 400);
    if (!ifsc_code) return sendError('ifsc_code is required', 400);
    if (!account_type) return sendError('account_type is required', 400);
    if (!holder_name) return sendError('holder_name is required', 400);

    const { data, error } = await supabase
      .from('banks')
      .insert({
        bank_name,
        branch_name: branch_name || null,
        account_number,
        ifsc_code,
        account_type,
        holder_name,
        opening_balance: opening_balance != null ? parseFloat(Number(opening_balance).toFixed(2)) : 0,
        status: 'active',
      })
      .select('id, bank_name, branch_name, account_number, ifsc_code, account_type, holder_name, opening_balance, status, created_at')
      .single();

    if (error) return sendError(error.message, 400);
    return sendSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
