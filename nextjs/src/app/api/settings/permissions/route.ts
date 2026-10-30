import { sendSuccess, authenticateRequest, isAuthError } from '@/lib/api-utils';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  // Return role-based permissions structure
  const permissions = {
    admin: {
      canManageUsers: true,
      canManageSettings: true,
      canApprove: true,
      canExport: true,
      canImport: true,
    },
    office: {
      canManageUsers: false,
      canManageSettings: false,
      canApprove: false,
      canExport: true,
      canImport: false,
    },
    supervisor: {
      canManageUsers: false,
      canManageSettings: false,
      canApprove: false,
      canExport: false,
      canImport: false,
    },
  };

  return sendSuccess(permissions);
}
