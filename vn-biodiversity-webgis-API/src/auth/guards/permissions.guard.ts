import { ForbiddenException, type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthTokenPayload } from '../types/auth-user.type';

interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(AUTH_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const permissions = new Set(request.user?.permissions ?? []);

    if (requiredPermissions.every((permission) => permissions.has(permission))) {
      return true;
    }

    throw new ForbiddenException('Tài khoản không có quyền thực hiện thao tác này.');
  }
}
