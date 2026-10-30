import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { getPendingDues } from '@/lib/services/reportAggregator';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  try {
    const data = await getPendingDues();
    return sendSuccess(data);
  } catch (err) {
    return sendError((err as Error).message, 500);
  }
}
