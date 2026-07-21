import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthRepository } from './auth.repository';
import type { AuthTokenPayload, AuthUser } from './types/auth-user.type';

const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = 'sha256';
const TOKEN_TTL_SECONDS = 60 * 60 * 8;

@Injectable()
export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async login(email: string | undefined, password: string | undefined) {
    if (!email?.trim() || !password) {
      throw new UnauthorizedException('Email hoặc mật khẩu không hợp lệ.');
    }

    const user = await this.authRepository.findUserByEmail(email.trim());

    if (!user || !user.isActive || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Email hoặc mật khẩu không hợp lệ.');
    }

    const safeUser: AuthUser = {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    };

    return {
      accessToken: this.signToken(safeUser),
      user: safeUser,
    };
  }

  verifyToken(token: string): AuthTokenPayload {
    const [headerPart, payloadPart, signature] = token.split('.');

    if (!headerPart || !payloadPart || !signature) {
      throw new UnauthorizedException('Token không hợp lệ.');
    }

    const expectedSignature = this.sign(`${headerPart}.${payloadPart}`);

    if (!this.safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException('Token không hợp lệ.');
    }

    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as AuthTokenPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.');
    }

    return payload;
  }

  hashPassword(password: string) {
    const salt = randomBytes(16).toString('base64url');
    const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('base64url');

    return `pbkdf2_${HASH_DIGEST}$${HASH_ITERATIONS}$${salt}$${hash}`;
  }

  private verifyPassword(password: string, storedHash: string) {
    const [algorithm, iterations, salt, hash] = storedHash.split('$');
    const digest = algorithm?.replace('pbkdf2_', '');

    if (!digest || !iterations || !salt || !hash) {
      return false;
    }

    const candidate = pbkdf2Sync(password, salt, Number(iterations), HASH_KEY_LENGTH, digest).toString('base64url');

    return this.safeEqual(candidate, hash);
  }

  private signToken(user: AuthUser) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.userId,
        email: user.email,
        roles: user.roles,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      }),
    ).toString('base64url');

    return `${header}.${payload}.${this.sign(`${header}.${payload}`)}`;
  }

  private sign(value: string) {
    return createHmac('sha256', process.env.AUTH_TOKEN_SECRET ?? 'vn-biodiversity-webgis-dev-secret')
      .update(value)
      .digest('base64url');
  }

  private safeEqual(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);

    return left.length === right.length && timingSafeEqual(left, right);
  }
}
