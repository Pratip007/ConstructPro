import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams } from '@/lib/api-utils';
import { getEntityLedger } from '@/lib/services/reportAggregator';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const searchParams = getSearchParams(request);
  const dateFrom = searchParams.from || null;
  const dateTo = searchParams.to || null;

  try {
    const data = await getEntityLedger('retailer', id, dateFrom, dateTo);
    return sendSuccess(data);
  } catch (err) {
    return sendError((err as Error).message, 500);
  }
}
