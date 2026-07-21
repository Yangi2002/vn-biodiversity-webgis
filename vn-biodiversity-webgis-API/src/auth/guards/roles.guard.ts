import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthTokenPayload } from '../types/auth-user.type';

interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(AUTH_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roles = request.user?.roles ?? [];

    return requiredRoles.some((role) => roles.includes(role));
  }
}
