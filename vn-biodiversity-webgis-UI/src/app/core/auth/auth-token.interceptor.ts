import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AdminAuthService);
  const token = auth.token();

  if (!token) {
    return next(request);
  }

  const authenticatedRequest = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const isAuthRequest = /\/auth\/(?:login|register|refresh)(?:\?|$)/.test(request.url);

      if (!isUnauthorized || isAuthRequest || !auth.refreshToken()) {
        return throwError(() => error);
      }

      return auth.refreshSession().pipe(
        switchMap((response) =>
          next(
            request.clone({
              setHeaders: { Authorization: `Bearer ${response.accessToken}` },
            }),
          ),
        ),
        catchError((refreshError) => {
          auth.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
