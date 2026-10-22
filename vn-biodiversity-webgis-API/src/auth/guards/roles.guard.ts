import { ForbiddenException, type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type GovernanceRole, hasAnyRole } from '../authorization/role-permission.matrix';
import { AUTH_ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthTokenPayload } from '../types/auth-user.type';

interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<GovernanceRole[]>(AUTH_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roles = request.user?.roles ?? [];

    if (hasAnyRole(roles, requiredRoles)) {
      return true;
    }

    throw new ForbiddenException('Tài khoản không có vai trò phù hợp.');
  }
}
