import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  handleApiError,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/employee-ledger/:employeeId
// Returns all credit/debit entries ordered by date with running balance.
// Employee role: can only access own ledger.
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const { employeeId } = await params;

    // Employee can only access own ledger
    if (user.role === 'employee' && String(user.id) !== employeeId) {
      return sendError('Access denied: can only view your own ledger', 403);
    }

    const { data, error } = await supabase
      .from('employee_ledger')
      .select('id, employee_id, attendance_id, type, credit_amount, debit_amount, description, transaction_date, created_at')
      .eq('employee_id', employeeId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) return sendError(error.message, 500);

    // Compute running balance
    let runningBalance = 0;
    const entriesWithBalance = (data || []).map((entry) => {
      runningBalance += Number(entry.credit_amount || 0) - Number(entry.debit_amount || 0);
      return { ...entry, running_balance: runningBalance };
    });

    return sendSuccess(entriesWithBalance);
  } catch (error) {
    return handleApiError(error);
  }
}
