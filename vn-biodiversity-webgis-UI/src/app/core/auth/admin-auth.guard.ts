import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: {
      returnUrl: state.url,
    },
  });
};
