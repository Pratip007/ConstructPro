import { sendSuccess, sendError, authenticateRequest, isAuthError, getSearchParams } from '@/lib/api-utils';
import { getEntityLedger } from '@/lib/services/reportAggregator';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const { id } = await params;
  const searchParams = getSearchParams(request);
  const dateFrom = searchParams.from || null;
  const dateTo = searchParams.to || null;

  // Employees may only view their own ledger
  if (user.role === 'employee' && String(user.id) !== String(id)) {
    return sendError('Access denied: can only view your own ledger', 403);
  }

  try {
    const data = await getEntityLedger('employee', id, dateFrom, dateTo);
    return sendSuccess(data);
  } catch (err) {
    return sendError((err as Error).message, 500);
  }
}
