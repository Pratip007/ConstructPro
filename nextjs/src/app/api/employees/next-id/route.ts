import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  generateDisplayId,
  handleApiError,
} from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office');
    if (roleCheck) return roleCheck;

    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true });

    if (error) return sendError(error.message, 500);
    const next = generateDisplayId('EMP', (count || 0) + 1);
    return sendSuccess({ next_id: next });
  } catch (error) {
    return handleApiError(error);
  }
}
