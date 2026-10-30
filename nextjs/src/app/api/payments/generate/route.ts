import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  getSearchParams,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/payments/generate - generate payroll data for a month
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const params = getSearchParams(request);
  const { month, site_id } = params;

  if (!month) return sendError('month parameter is required (YYYY-MM)', 400);

  let empQuery = supabase
    .from('employees')
    .select('id, display_id, name, rate, salary_basis, site_id, bank_name, account_no, ifsc')
    .eq('status', 'active');

  if (site_id) empQuery = empQuery.eq('site_id', site_id);

  const { data: employees, error: empErr } = await empQuery;
  if (empErr) return sendError(empErr.message, 500);

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  const payroll = [];
  for (const emp of (employees || [])) {
    const { data: att } = await supabase
      .from('attendance')
      .select('status')
      .eq('employee_id', emp.id)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    const daysPresent = (att || []).filter((a: { status: string }) => a.status === 'P' || a.status === 'present').length;
    const daysAbsent = daysInMonth - daysPresent;
    const daysLeave = (att || []).filter((a: { status: string }) => a.status === 'L' || a.status === 'leave').length;
    const rate = Number(emp.rate || 0);
    const grossPay = emp.salary_basis === 'Monthly' ? rate : rate * daysPresent;

    payroll.push({
      id: emp.id,
      employeeId: emp.id,
      displayId: emp.display_id,
      employee: emp.name,
      site: emp.site_id,
      daysWorked: daysPresent,
      daysAbsent,
      daysLeave,
      rate,
      grossPay,
      deductions: 0,
      finalPayment: grossPay,
      bankName: emp.bank_name,
      accountNo: emp.account_no,
      ifsc: emp.ifsc,
      status: 'pending',
    });
  }

  return sendSuccess(payroll);
}
