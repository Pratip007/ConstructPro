import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams } from '@/lib/api-utils';
import { getSiteLedger } from '@/lib/services/reportAggregator';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { company_id, site_id } = getSearchParams(request);

  if (!site_id) return sendError('site_id is required', 400);

  try {
    const data = await getSiteLedger(company_id || null, site_id);
    return sendSuccess(data);
  } catch (err) {
    return sendError((err as Error).message, 500);
  }
}
