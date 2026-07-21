import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AdminAuthService).token();

  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
