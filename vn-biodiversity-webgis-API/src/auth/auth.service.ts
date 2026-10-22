import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthRepository } from './auth.repository';
import {
  GOVERNANCE_PERMISSIONS,
  isGovernancePermission,
  isGovernanceRole,
  normalizePermissions,
  normalizeRoles,
  type GovernancePermission,
} from './authorization/role-permission.matrix';
import type { AuthTokenPayload, AuthUser } from './types/auth-user.type';
import type { RegisterDto } from './dto/register.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = 'sha256';
const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

interface ValidatedProfile {
  displayName: string;
  birthDate: string;
  gender: 'male' | 'female';
  phone: string;
}

interface ValidatedProfileUpdate {
  displayName: string | null;
  birthDate: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
}

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

    return this.createSession(this.toAuthUser(user));
  }

  async register(input: RegisterDto) {
    const profile = this.validateProfile(input);
    const email = this.validateEmail(input.email);
    const password = this.validatePassword(input.password, input.confirmPassword);

    if (await this.authRepository.findUserByEmail(email)) {
      throw new ConflictException('Email đã được sử dụng.');
    }

    let user: Awaited<ReturnType<AuthRepository['createRegisteredUser']>>;
    try {
      user = await this.authRepository.createRegisteredUser({
        ...profile,
        email,
        passwordHash: this.hashPassword(password),
      });
    } catch (error) {
      if (this.databaseErrorCode(error) === '23505') {
        throw new ConflictException('Email đã được sử dụng.');
      }
      throw error;
    }

    return this.createSession(this.toAuthUser(user));
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Thiếu refresh token.');
    }

    const session = await this.authRepository.findSessionByRefreshTokenHash(this.hashRefreshToken(refreshToken));

    if (!session?.isActive) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ.');
    }

    const user = this.toAuthUser(session);
    const nextRefreshToken = this.newRefreshToken();
    const expiresAt = this.refreshExpiresAt();

    await this.authRepository.rotateSession(session.sessionId, this.hashRefreshToken(nextRefreshToken), expiresAt);

    return {
      accessToken: this.signToken(user, session.sessionId),
      refreshToken: nextRefreshToken,
      user,
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

    let payload: AuthTokenPayload;

    try {
      payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ.');
    }

    if (!payload.exp || !payload.sid || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.');
    }

    return payload;
  }

  async authenticateToken(token: string) {
    const payload = this.verifyToken(token);
    const [user, sessionActive] = await Promise.all([
      this.authRepository.findUserById(payload.sub),
      this.authRepository.isSessionActive(payload.sid, payload.sub),
    ]);

    if (!sessionActive || !user?.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }

    return {
      sub: user.userId,
      sid: payload.sid,
      email: user.email,
      roles: normalizeRoles(user.roles),
      permissions: this.effectivePermissions(user.roles, user.permissions),
      exp: payload.exp,
    };
  }

  async currentUser(payload: AuthTokenPayload): Promise<AuthUser> {
    const user = await this.authRepository.findUserById(payload.sub);

    if (!user?.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }

    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      birthDate: user.birthDate,
      gender: user.gender === 'male' || user.gender === 'female' ? user.gender : null,
      phone: user.phone,
      roles: normalizeRoles(user.roles),
      permissions: this.effectivePermissions(user.roles, user.permissions),
    };
  }

  async updateProfile(payload: AuthTokenPayload, input: UpdateProfileDto) {
    const profile = this.validateProfileUpdate(input);
    const email = this.validateEmail(input.email);
    const changingPassword = Boolean(input.password || input.confirmPassword);
    const passwordHash = changingPassword
      ? this.hashPassword(this.validatePassword(input.password, input.confirmPassword))
      : undefined;

    let user: Awaited<ReturnType<AuthRepository['updateProfile']>>;
    try {
      user = await this.authRepository.updateProfile(payload.sub, { ...profile, email, passwordHash });
    } catch (error) {
      if (this.databaseErrorCode(error) === '23505') {
        throw new ConflictException('Email đã được sử dụng.');
      }
      throw error;
    }

    if (!user?.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }

    if (passwordHash) {
      await this.authRepository.revokeOtherSessions(payload.sub, payload.sid);
    }

    return this.toAuthUser(user);
  }

  hashPassword(password: string) {
    const salt = randomBytes(16).toString('base64url');
    const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('base64url');

    return `pbkdf2_${HASH_DIGEST}$${HASH_ITERATIONS}$${salt}$${hash}`;
  }

  permissionMatrix() {
    return this.authRepository.rolePermissionMatrix();
  }

  async updateRolePermissions(roleCode: string, values: unknown) {
    if (!isGovernanceRole(roleCode) || roleCode === 'administrator') {
      throw new BadRequestException('Không thể chỉnh quyền của vai trò này.');
    }
    if (!Array.isArray(values)) {
      throw new BadRequestException('Danh sách quyền không hợp lệ.');
    }

    const permissions = Array.from(new Set(values));
    if (!permissions.every((permission): permission is GovernancePermission =>
      typeof permission === 'string' && isGovernancePermission(permission))) {
      throw new BadRequestException('Danh sách quyền không hợp lệ.');
    }

    await this.authRepository.replaceRolePermissions(roleCode, permissions);
    return this.authRepository.rolePermissionMatrix();
  }

  async logout(payload: AuthTokenPayload) {
    await this.authRepository.revokeSession(payload.sid);

    return { success: true };
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

  private async createSession(user: AuthUser) {
    const refreshToken = this.newRefreshToken();
    const sessionId = await this.authRepository.createSession(
      user.userId,
      this.hashRefreshToken(refreshToken),
      this.refreshExpiresAt(),
    );

    return {
      accessToken: this.signToken(user, sessionId),
      refreshToken,
      user,
    };
  }

  private signToken(user: AuthUser, sessionId: string) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.userId,
        sid: sessionId,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
      }),
    ).toString('base64url');

    return `${header}.${payload}.${this.sign(`${header}.${payload}`)}`;
  }

  private toAuthUser(user: {
    userId: string;
    email: string;
    displayName: string | null;
    birthDate: string | null;
    gender: string | null;
    phone: string | null;
    roles: string[];
    permissions: string[];
  }): AuthUser {
    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      birthDate: user.birthDate,
      gender: user.gender === 'male' || user.gender === 'female' ? user.gender : null,
      phone: user.phone,
      roles: normalizeRoles(user.roles),
      permissions: this.effectivePermissions(user.roles, user.permissions),
    };
  }

  private effectivePermissions(roles: readonly string[], permissions: readonly string[]) {
    return normalizeRoles(roles).includes('administrator')
      ? [...GOVERNANCE_PERMISSIONS]
      : normalizePermissions(permissions);
  }

  private validateProfile(input: RegisterDto | UpdateProfileDto): ValidatedProfile {
    const displayName = input.displayName?.trim();
    const birthDate = input.birthDate?.trim();
    const gender = input.gender?.trim();
    const phone = input.phone?.trim().replace(/[\s.-]/g, '');

    if (!displayName || displayName.length < 2 || displayName.length > 100) {
      throw new BadRequestException('Họ tên phải có từ 2 đến 100 ký tự.');
    }

    const parsedBirthDate = birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)
      ? new Date(`${birthDate}T00:00:00Z`)
      : null;
    if (
      !birthDate ||
      !parsedBirthDate ||
      Number.isNaN(parsedBirthDate.getTime()) ||
      parsedBirthDate.toISOString().slice(0, 10) !== birthDate ||
      parsedBirthDate > new Date()
    ) {
      throw new BadRequestException('Ngày sinh không hợp lệ.');
    }

    if (gender !== 'male' && gender !== 'female') {
      throw new BadRequestException('Giới tính không hợp lệ.');
    }

    if (!phone || !/^\+?[0-9]{8,15}$/.test(phone)) {
      throw new BadRequestException('Số điện thoại không hợp lệ.');
    }

    return { displayName, birthDate, gender, phone };
  }

  private validateProfileUpdate(input: UpdateProfileDto): ValidatedProfileUpdate {
    const displayName = input.displayName?.trim() || null;
    const birthDate = input.birthDate?.trim() || null;
    const gender = input.gender?.trim() || null;
    const phone = input.phone?.trim().replace(/[\s.-]/g, '') || null;

    if (displayName && (displayName.length < 2 || displayName.length > 100)) {
      throw new BadRequestException('Họ tên phải có từ 2 đến 100 ký tự.');
    }

    if (birthDate) {
      const parsedBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate)
        ? new Date(`${birthDate}T00:00:00Z`)
        : null;
      if (
        !parsedBirthDate ||
        Number.isNaN(parsedBirthDate.getTime()) ||
        parsedBirthDate.toISOString().slice(0, 10) !== birthDate ||
        parsedBirthDate > new Date()
      ) {
        throw new BadRequestException('Ngày sinh không hợp lệ.');
      }
    }

    if (gender !== null && gender !== 'male' && gender !== 'female') {
      throw new BadRequestException('Giới tính không hợp lệ.');
    }

    if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) {
      throw new BadRequestException('Số điện thoại không hợp lệ.');
    }

    return { displayName, birthDate, gender, phone };
  }

  private validateEmail(value: string | undefined) {
    const email = value?.trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Email không hợp lệ.');
    }

    return email;
  }

  private validatePassword(password: string | undefined, confirmPassword: string | undefined) {
    if (!password || password.length < 8 || password.length > 128) {
      throw new BadRequestException('Mật khẩu phải có từ 8 đến 128 ký tự.');
    }

    if (password !== confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

    return password;
  }

  private newRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('base64url');
  }

  private refreshExpiresAt() {
    return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  }

  private databaseErrorCode(error: unknown) {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return null;
    }

    return String(error.code);
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
