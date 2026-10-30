import { NextRequest } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

const LOAN_SELECT = 'id, display_id, loan_id_external, bank, purpose, principal, interest_type, interest_value, tenure, total_payable, monthly_emi, due_date, remind_days, start_date, status, created_at';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data: loan, error: loanError } = await supabase
    .from('company_loans')
    .select(LOAN_SELECT)
    .eq('id', id)
    .single();

  if (loanError) return sendError(loanError.message, 500);
  if (!loan) return sendError('Loan not found', 404);

  const { data: emis, error: emisError } = await supabase
    .from('company_emis')
    .select('id, loan_id, date, ref_no, pay_bank, amount, created_at')
    .eq('loan_id', id)
    .order('date', { ascending: false });

  if (emisError) return sendError(emisError.message, 500);

  return sendSuccess({ ...loan, emis: emis || [] });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  const allowedFields = [
    'loan_id_external', 'bank', 'purpose', 'due_date',
    'remind_days', 'start_date', 'status',
  ];
  const updates: Record<string, unknown> = {};
  allowedFields.forEach((f) => {
    if (body[f] !== undefined) updates[f] = body[f];
  });

  if (Object.keys(updates).length === 0) {
    return sendError('No fields to update', 400);
  }

  const { data, error } = await supabase
    .from('company_loans')
    .update(updates)
    .eq('id', id)
    .select(LOAN_SELECT)
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Loan not found', 404);
  return sendSuccess(data);
}
