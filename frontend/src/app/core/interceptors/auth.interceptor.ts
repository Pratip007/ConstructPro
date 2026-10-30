import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('atr_access_token');

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  const router = inject(Router);

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        localStorage.removeItem('atr_access_token');
        localStorage.removeItem('atr_refresh_token');
        localStorage.removeItem('atr_current_logged_user');
        localStorage.removeItem('atr_current_logged_portal');
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
