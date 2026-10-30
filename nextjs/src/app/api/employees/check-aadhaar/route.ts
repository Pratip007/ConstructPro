import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  getSearchParams,
  handleApiError,
} from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office');
    if (roleCheck) return roleCheck;

    const params = getSearchParams(request);
    const { aadhaar } = params;
    if (!aadhaar) return sendError('aadhaar parameter is required', 400);

    const { data, error } = await supabase
      .from('employees')
      .select('id, display_id, name')
      .eq('aadhaar_last4', String(aadhaar).slice(-4))
      .limit(5);

    if (error) return sendError(error.message, 500);
    return sendSuccess({ exists: (data || []).length > 0, matches: data || [] });
  } catch (error) {
    return handleApiError(error);
  }
}
