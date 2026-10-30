import { NextRequest } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { processApproval } from '@/lib/services/approvalEngine';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateRequest(request);
  if (isAuthError(authResult)) return authResult;
  const user = authResult;

  const roleError = requireRole(user, 'admin');
  if (roleError) return roleError;

  const { id } = await params;
  const body = await request.json();
  const { remarks } = body;

  try {
    const result = await processApproval(id, 'approved', remarks || null, user.id);
    return sendSuccess(result);
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return sendError(error.message || 'Failed to process approval', error.status || 500);
  }
}
