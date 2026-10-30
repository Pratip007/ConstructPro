import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { type, purpose, from, to, bank_account, from_date, to_date } = getSearchParams(request);

  let q = supabase
    .from('income_expenses')
    .select('id, date, type, bank_account, purpose, particulars, remark, amount, status, created_at')
    .neq('status', 'inactive')
    .order('date', { ascending: false });

  if (type) q = q.eq('type', type);
  if (purpose) q = q.eq('purpose', purpose);
  if (bank_account) q = q.eq('bank_account', bank_account);
  if (from || from_date) q = q.gte('date', from || from_date);
  if (to || to_date) q = q.lte('date', to || to_date);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);

  // Compute summary
  let totalIncome = 0;
  let totalExpense = 0;
  (data || []).forEach((entry) => {
    const amount = parseFloat(Number(entry.amount).toFixed(2));
    if (entry.type === 'Income') totalIncome += amount;
    else if (entry.type === 'Expense') totalExpense += amount;
  });
  totalIncome = parseFloat(totalIncome.toFixed(2));
  totalExpense = parseFloat(totalExpense.toFixed(2));
  const netBalance = parseFloat(Number(totalIncome - totalExpense).toFixed(2));

  return sendSuccess({
    entries: data || [],
    summary: { totalIncome, totalExpense, netBalance },
  });
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { date, type, bank_account, purpose, particulars, remark, amount } = body;

  if (!date) return sendError('date is required', 400);
  if (!type || !['Income', 'Expense'].includes(type)) return sendError('type must be Income or Expense', 400);
  if (amount === undefined || isNaN(Number(amount))) return sendError('amount must be numeric', 400);

  const { data, error } = await supabase
    .from('income_expenses')
    .insert({
      date,
      type,
      bank_account: bank_account || null,
      purpose: purpose || null,
      particulars: particulars || null,
      remark: remark || null,
      amount: parseFloat(Number(amount).toFixed(2)),
      status: 'active',
    })
    .select('id, date, type, bank_account, purpose, particulars, remark, amount, status, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
