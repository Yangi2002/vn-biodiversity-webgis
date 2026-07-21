import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { AuthTokenPayload } from '../types/auth-user.type';

interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Thiếu token đăng nhập.');
    }

    request.user = this.authService.verifyToken(token);

    return true;
  }
}
