import { NextRequest } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('company_emis')
    .select('id, loan_id, date, ref_no, pay_bank, amount, created_at')
    .eq('loan_id', id)
    .order('date', { ascending: false });

  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();
  const { date, ref_no, pay_bank, amount } = body;

  if (!date) return sendError('date is required', 400);
  if (amount === undefined || amount === null) return sendError('amount must be numeric', 400);

  const parsedAmount = parseFloat(Number(amount).toFixed(2));

  const { data, error } = await supabase
    .from('company_emis')
    .insert({
      loan_id: id,
      date,
      ref_no: ref_no || null,
      pay_bank: pay_bank || null,
      amount: parsedAmount,
    })
    .select('id, loan_id, date, ref_no, pay_bank, amount, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
