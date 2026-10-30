import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (isAuthError(authResult)) return authResult;
  const user = authResult;

  const roleError = requireRole(user, 'admin');
  if (roleError) return roleError;

  const { count: officeCount, error: officeError } = await supabase
    .from('approval_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('source', 'office');

  if (officeError) return sendError(officeError.message, 500);

  const { count: supervisorCount, error: supervisorError } = await supabase
    .from('approval_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('source', 'supervisor');

  if (supervisorError) return sendError(supervisorError.message, 500);

  const { count: loansCount, error: loansError } = await supabase
    .from('approval_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('module', 'Loan');

  if (loansError) return sendError(loansError.message, 500);

  return sendSuccess({
    office: officeCount || 0,
    supervisor: supervisorCount || 0,
    loans: loansCount || 0,
  });
}
