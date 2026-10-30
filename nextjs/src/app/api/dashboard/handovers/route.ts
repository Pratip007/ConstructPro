import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  try {
    const { data, error } = await supabase
      .from('sites')
      .select('id, display_id, name, status, updated_at, companies(name)')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) return sendError(error.message, 500);

    const result = (data || []).map((s: any) => ({
      id: s.id,
      site_name: s.name,
      client_name: s.companies?.name ?? '—',
      status: s.status,
      updated_at: s.updated_at,
    }));

    return sendSuccess(result);
  } catch (err) {
    return sendError((err as Error).message, 500);
  }
}
