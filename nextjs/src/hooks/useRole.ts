'use client';

import { useAuth } from '@/contexts/AuthContext';

export function useRole() {
  const { user } = useAuth();

  return {
    isAdmin: user?.role === 'admin',
    isOffice: user?.role === 'office',
    isSupervisor: user?.role === 'supervisor',
    isEmployee: user?.role === 'employee',
    hasRole: (...roles: string[]) => !!user && roles.includes(user.role),
    getSiteId: () => user?.assignedSiteId || null,
    user,
  };
}
