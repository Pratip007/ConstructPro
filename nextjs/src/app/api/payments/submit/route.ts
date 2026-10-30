import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  generateDisplayId,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// POST /api/payments/submit - batch submit employee payments
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { month, site_id, payment_date, payments: paymentList } = body;

  if (!Array.isArray(paymentList) || !paymentList.length) {
    return sendError('payments array is required', 400);
  }

  const results = { created: 0, errors: [] as { employee_id: string; error: string }[] };
  for (const p of paymentList) {
    const { count } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true });
    const display_id = generateDisplayId('PAY', (count || 0) + 1);

    const { error } = await supabase.from('payments').insert({
      display_id,
      date: payment_date || new Date().toISOString().slice(0, 10),
      category: 'employee',
      party_type: 'employee',
      party_id: p.employee_id,
      site_id: site_id || null,
      amount: p.final_payment,
      status: 'cleared',
      remarks: `Payroll ${month}`,
      created_by: user.id,
    });

    if (error) {
      results.errors.push({ employee_id: p.employee_id, error: error.message });
    } else {
      results.created++;
    }
  }

  return sendSuccess(results, 201);
}
