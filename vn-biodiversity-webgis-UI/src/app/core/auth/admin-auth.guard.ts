import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: {
        returnUrl: state.url,
      },
    });
  }

  return auth.me().pipe(
    map(() => true),
    catchError(() => {
      auth.logout();

      return of(
        router.createUrlTree(['/login'], {
          queryParams: {
            returnUrl: state.url,
          },
        }),
      );
    }),
  );
};
