import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import type { GovernancePermission, GovernanceRole } from '../../data-access/models/auth/auth.model';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';

export const adminPermissionGuard: CanActivateFn = (route) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  const requiredRoles = (route.data?.['roles'] ?? []) as GovernanceRole[];
  const requiredPermissions = (route.data?.['permissions'] ?? []) as GovernancePermission[];

  const canAccess = () => {
    const roleAllowed = requiredRoles.length ? auth.hasRole(requiredRoles) : true;
    const permissionAllowed = requiredPermissions.length ? auth.hasPermission(requiredPermissions) : true;

    return roleAllowed && permissionAllowed;
  };

  if (canAccess()) {
    return true;
  }

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  return auth.me().pipe(
    map(() => (canAccess() ? true : router.createUrlTree(['/admin']))),
    catchError(() => {
      auth.logout();

      return of(router.createUrlTree(['/login']));
    }),
  );
};
