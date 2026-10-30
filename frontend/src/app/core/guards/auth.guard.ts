import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService, PortalType } from '../services/auth.service';

const PORTAL_ROUTES: Record<PortalType, string> = {
  admin: '/admin',
  office: '/office',
  supervisor: '/supervisor',
  employee: '/admin/employee/employee-ledger',
};

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const hasToken = !!localStorage.getItem('atr_access_token');

  if (!auth.isLoggedIn() || !hasToken) {
    auth.logout();
    return router.createUrlTree(['/login']);
  }

  const requiredRole = route.data?.['requiredRole'] as PortalType | undefined;
  if (requiredRole) {
    const userRole = auth.currentUser()?.role;
    if (userRole !== requiredRole) {
      // Redirect to the user's own portal instead of blocking entirely
      const destination = PORTAL_ROUTES[userRole as PortalType] ?? '/login';
      return router.createUrlTree([destination]);
    }
  }

  return true;
};
