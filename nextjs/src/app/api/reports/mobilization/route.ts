import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const params = getSearchParams(request);
  const { site_id, party_id } = params;
  const dateFrom = params.from;
  const dateTo = params.to;

  let q = supabase
    .from('equipment_site_assignments')
    .select(
      'id, display_id, equipment_party_id, site_id, assigned_date, released_date, rate, rate_unit, status, remarks, created_at'
    )
    .order('assigned_date', { ascending: false });

  if (site_id) q = q.eq('site_id', site_id);
  if (party_id) q = q.eq('equipment_party_id', party_id);
  if (dateFrom) q = q.gte('assigned_date', dateFrom);
  if (dateTo) q = q.lte('assigned_date', dateTo);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);

  // Enrich with computed fields
  const enriched = (data || []).map((row) => {
    let duration_days: number | null = null;
    let total_cost: number | null = null;

    if (row.assigned_date && row.released_date) {
      const start = new Date(row.assigned_date);
      const end = new Date(row.released_date);
      duration_days = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      total_cost = Number(row.rate || 0) * duration_days;
    }

    return { ...row, duration_days, total_cost };
  });

  return sendSuccess(enriched);
}
