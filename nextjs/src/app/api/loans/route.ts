import { NextRequest } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

const LOAN_SELECT = 'id, display_id, loan_id_external, bank, purpose, principal, interest_type, interest_value, tenure, total_payable, monthly_emi, due_date, remind_days, start_date, status, created_at';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { status } = getSearchParams(request);

  let q = supabase
    .from('company_loans')
    .select(LOAN_SELECT)
    .order('created_at', { ascending: false });

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const {
    loan_id_external, bank, purpose,
    principal, interest_type, interest_value, tenure,
    due_date, remind_days, start_date, status,
  } = body;

  if (!principal || !interest_type || !interest_value || !tenure || !due_date) {
    return sendError('principal, interest_type, interest_value, tenure, and due_date are required', 400);
  }

  if (interest_type !== '%' && interest_type !== '₹') {
    return sendError("interest_type must be '%' or '₹'", 400);
  }

  const { count, error: countError } = await supabase
    .from('company_loans')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
  const display_id = generateDisplayId('LOAN', (count || 0) + 1);

  const principalAmt = parseFloat(Number(principal).toFixed(2));
  const interestVal = parseFloat(Number(interest_value).toFixed(2));
  const tenureInt = parseInt(tenure, 10);

  let total_payable: number;
  if (interest_type === '%') {
    total_payable = parseFloat(Number(principalAmt + (principalAmt * interestVal / 100 * tenureInt / 12)).toFixed(2));
  } else {
    total_payable = parseFloat(Number(principalAmt + (interestVal * tenureInt)).toFixed(2));
  }

  const monthly_emi = parseFloat(Number(total_payable / tenureInt).toFixed(2));

  const { data, error } = await supabase
    .from('company_loans')
    .insert({
      display_id,
      loan_id_external: loan_id_external || null,
      bank: bank || null,
      purpose: purpose || null,
      principal: principalAmt,
      interest_type,
      interest_value: interestVal,
      tenure: tenureInt,
      total_payable,
      monthly_emi,
      due_date: parseInt(due_date, 10),
      remind_days: remind_days !== undefined ? parseInt(remind_days, 10) : 5,
      start_date: start_date || null,
      status: status || 'active',
    })
    .select(LOAN_SELECT)
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
