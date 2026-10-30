import { NextRequest } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

const LOAN_SELECT = 'id, display_id, loan_id_external, bank, purpose, principal, interest_type, interest_value, tenure, total_payable, monthly_emi, due_date, remind_days, start_date, status, created_at';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const today = new Date();
  const currentDay = today.getDate();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-based

  // Fetch all active loans
  const { data: loans, error: loansError } = await supabase
    .from('company_loans')
    .select(LOAN_SELECT)
    .eq('status', 'active');

  if (loansError) return sendError(loansError.message, 500);

  const reminders = [];

  for (const loan of (loans || [])) {
    const dueDate = Number(loan.due_date);
    const remindDays = Number(loan.remind_days || 5);

    // Check if today is within due_date +/- remind_days
    const diff = Math.abs(currentDay - dueDate);
    if (diff > remindDays) continue;

    // Check if an EMI exists for current month/year
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: emis, error: emisError } = await supabase
      .from('company_emis')
      .select('id')
      .eq('loan_id', loan.id)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (emisError) return sendError(emisError.message, 500);

    if (!emis || emis.length === 0) {
      reminders.push(loan);
    }
  }

  return sendSuccess(reminders);
}
