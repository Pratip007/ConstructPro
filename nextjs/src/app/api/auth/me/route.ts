import { NextRequest } from 'next/server';
import {
  sendSuccess,
  authenticateRequest,
  isAuthError,
  handleApiError,
} from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    // authenticateRequest already loaded the profile — return it directly.
    return sendSuccess({
      id: user.id,
      auth_uid: user.authUid,
      display_id: user.displayId,
      name: user.name,
      role: user.role,
      assigned_site_id: user.siteId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
