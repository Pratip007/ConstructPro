import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { company_id, fy } = getSearchParams(request);

  let q = supabase
    .from('invoices')
    .select('id, display_id, company_id, date, base_amount, gst_amount, gross_amount, is_gst, status')
    .order('date', { ascending: true });

  if (company_id) q = q.eq('company_id', company_id);

  if (fy) {
    if (!/^\d{4}$/.test(fy)) return sendError('fy must be a 4-digit year (e.g., 2026)', 400);
    const fyStart = `${fy}-04-01`;
    const fyEnd = `${parseInt(fy, 10) + 1}-03-31`;
    q = q.gte('date', fyStart).lte('date', fyEnd);
  }

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);

  // Group by month
  const byMonth: Record<string, { month: string; invoices: typeof data; total_gross: number; total_base: number; total_gst: number }> = {};
  for (const inv of data || []) {
    const month = String(inv.date).substring(0, 7);
    if (!byMonth[month]) {
      byMonth[month] = { month, invoices: [], total_gross: 0, total_base: 0, total_gst: 0 };
    }
    byMonth[month].invoices.push(inv);
    byMonth[month].total_gross += Number(inv.gross_amount || 0);
    byMonth[month].total_base += Number(inv.base_amount || 0);
    byMonth[month].total_gst += Number(inv.gst_amount || 0);
  }

  const monthly = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  const grandTotal = {
    gross: monthly.reduce((s, m) => s + m.total_gross, 0),
    base: monthly.reduce((s, m) => s + m.total_base, 0),
    gst: monthly.reduce((s, m) => s + m.total_gst, 0),
  };

  return sendSuccess({ monthly, grandTotal });
}
