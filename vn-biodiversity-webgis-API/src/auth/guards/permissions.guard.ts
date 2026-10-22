import { ForbiddenException, type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type GovernancePermission, hasEveryPermission } from '../authorization/role-permission.matrix';
import { AUTH_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthTokenPayload } from '../types/auth-user.type';

interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<GovernancePermission[]>(AUTH_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (hasEveryPermission(request.user?.permissions ?? [], requiredPermissions)) {
      return true;
    }

    throw new ForbiddenException('Tài khoản không có quyền thực hiện thao tác này.');
  }
}
