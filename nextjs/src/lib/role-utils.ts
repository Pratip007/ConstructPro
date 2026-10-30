export type PortalType = 'admin' | 'office' | 'employee' | 'supervisor';

export interface UserProfile {
  id: number;
  authUid?: string;
  displayId: string;
  name: string;
  role: string;
  siteId?: number | string | null;
  assignedSiteId?: number | string | null;
}

type UserLike = { role?: string; siteId?: any; assignedSiteId?: any } | null;

export function getCurrentRole(user: UserLike): PortalType | null {
  return (user?.role as PortalType) || null;
}

export function isAdmin(user: UserLike): boolean {
  return user?.role === 'admin';
}

export function isOffice(user: UserLike): boolean {
  return user?.role === 'office';
}

export function isSupervisor(user: UserLike): boolean {
  return user?.role === 'supervisor';
}

export function isEmployee(user: UserLike): boolean {
  return user?.role === 'employee';
}

export function isSiteLocked(user: UserLike): boolean {
  return user?.role === 'supervisor' && (user?.siteId != null || user?.assignedSiteId != null);
}

export function getSupervisorSiteId(user: UserLike): number | string | null {
  if (user?.role === 'supervisor') return user.siteId ?? user.assignedSiteId ?? null;
  return null;
}

export function canEdit(user: UserLike): boolean {
  return user?.role === 'admin' || user?.role === 'office';
}

export function canDelete(user: UserLike): boolean {
  return user?.role === 'admin';
}

export function getRoleBadge(user: UserLike): { label: string; cssClass: string } {
  switch (user?.role) {
    case 'admin': return { label: 'Admin', cssClass: 'badge-admin' };
    case 'office': return { label: 'Office', cssClass: 'badge-office' };
    case 'supervisor': return { label: 'Supervisor', cssClass: 'badge-supervisor' };
    case 'employee': return { label: 'Employee', cssClass: 'badge-employee' };
    default: return { label: 'Unknown', cssClass: 'badge-default' };
  }
}

export const ROLE_ROUTES: Record<PortalType, string> = {
  admin: '/admin',
  office: '/office',
  supervisor: '/supervisor',
  employee: '/admin/employee/employee-ledger',
};
