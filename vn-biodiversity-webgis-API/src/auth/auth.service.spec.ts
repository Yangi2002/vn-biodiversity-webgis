import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

const USER_ID = 'f0cd5a1b-96c5-4fb4-81f8-adf942ec88ea';
const SESSION_ID = '30b9f75d-60fb-4d0f-a3dd-e539675e128c';

describe('AuthService account sessions', () => {
  const repository = {
    findUserByEmail: jest.fn<AuthRepository['findUserByEmail']>(),
    findUserById: jest.fn<AuthRepository['findUserById']>(),
    createRegisteredUser: jest.fn<AuthRepository['createRegisteredUser']>(),
    updateProfile: jest.fn<AuthRepository['updateProfile']>(),
    createSession: jest.fn<AuthRepository['createSession']>(),
    findSessionByRefreshTokenHash: jest.fn<AuthRepository['findSessionByRefreshTokenHash']>(),
    rotateSession: jest.fn<AuthRepository['rotateSession']>(),
    isSessionActive: jest.fn<AuthRepository['isSessionActive']>(),
    revokeSession: jest.fn<AuthRepository['revokeSession']>(),
    revokeOtherSessions: jest.fn<AuthRepository['revokeOtherSessions']>(),
    rolePermissionMatrix: jest.fn<AuthRepository['rolePermissionMatrix']>(),
    replaceRolePermissions: jest.fn<AuthRepository['replaceRolePermissions']>(),
  };
  const service = new AuthService(repository as unknown as AuthRepository);

  const user = (overrides: Record<string, unknown> = {}) => ({
    userId: USER_ID,
    email: 'member@example.test',
    displayName: 'Member',
    birthDate: '1990-01-02',
    gender: 'female',
    phone: '0901234567',
    passwordHash: service.hashPassword('secret123'),
    isActive: true,
    roles: ['registered-user'],
    permissions: ['species.view.full', 'species.view.published'],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_TOKEN_SECRET = 'unit-test-secret';
    repository.createSession.mockResolvedValue(SESSION_ID);
    repository.isSessionActive.mockResolvedValue(true);
  });

  it('updates permissions for a non-administrator role', async () => {
    repository.rolePermissionMatrix.mockResolvedValue({ roles: [], permissions: [] });

    await service.updateRolePermissions('editor-staff', ['data.import', 'species.update']);

    expect(repository.replaceRolePermissions).toHaveBeenCalledWith('editor-staff', [
      'data.import',
      'species.update',
    ]);
  });

  it('keeps administrator permissions immutable', async () => {
    await expect(service.updateRolePermissions('administrator', [])).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('updates the complete profile without changing the password when password fields are empty', async () => {
    repository.updateProfile.mockResolvedValue(user({ email: 'updated@example.test' }));

    const result = await service.updateProfile(
      { sub: USER_ID, sid: SESSION_ID, email: 'member@example.test', roles: [], permissions: [], exp: 1 },
      {
        displayName: 'Updated Member',
        email: 'updated@example.test',
        birthDate: '1990-01-02',
        gender: 'female',
        phone: '0901234567',
        password: '',
        confirmPassword: '',
      },
    );

    expect(result.email).toBe('updated@example.test');
    expect(repository.updateProfile).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ email: 'updated@example.test', passwordHash: undefined }),
    );
    expect(repository.revokeOtherSessions).not.toHaveBeenCalled();
  });

  it('allows optional profile details to remain empty', async () => {
    repository.updateProfile.mockResolvedValue(
      user({ displayName: null, birthDate: null, gender: null, phone: null }),
    );

    await service.updateProfile(
      { sub: USER_ID, sid: SESSION_ID, email: 'member@example.test', roles: [], permissions: [], exp: 1 },
      {
        displayName: '',
        email: 'member@example.test',
        birthDate: '',
        gender: '',
        phone: '',
        password: '',
        confirmPassword: '',
      },
    );

    expect(repository.updateProfile).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ displayName: null, birthDate: null, gender: null, phone: null }),
    );
  });

  it('hashes a new profile password and revokes other sessions', async () => {
    repository.updateProfile.mockResolvedValue(user());

    await service.updateProfile(
      { sub: USER_ID, sid: SESSION_ID, email: 'member@example.test', roles: [], permissions: [], exp: 1 },
      {
        displayName: 'Member',
        email: 'member@example.test',
        birthDate: '1990-01-02',
        gender: 'female',
        phone: '0901234567',
        password: 'new-secret-123',
        confirmPassword: 'new-secret-123',
      },
    );

    expect(repository.updateProfile).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ passwordHash: expect.stringContaining('pbkdf2_sha256$') }),
    );
    expect(repository.revokeOtherSessions).toHaveBeenCalledWith(USER_ID, SESSION_ID);
  });

  it('returns database-backed roles and a refresh session at login', async () => {
    repository.findUserByEmail.mockResolvedValue(user());

    const result = await service.login('member@example.test', 'secret123');

    expect(result.user.roles).toEqual(['registered-user']);
    expect(result.refreshToken).toBeTruthy();
    expect(repository.createSession).toHaveBeenCalledWith(USER_ID, expect.any(String), expect.any(Date));
  });

  it('always grants the complete permission set to administrator', async () => {
    repository.findUserByEmail.mockResolvedValue(user({ roles: ['administrator'], permissions: [] }));

    const result = await service.login('member@example.test', 'secret123');

    expect(result.user.permissions).toContain('system.manage');
    expect(result.user.permissions).toContain('roles.manage');
    expect(result.user.permissions).toContain('species.publish');
  });

  it('registers a new account with validated profile data', async () => {
    repository.findUserByEmail.mockResolvedValue(null);
    repository.createRegisteredUser.mockResolvedValue(user());

    const result = await service.register({
      displayName: 'Member',
      email: 'member@example.test',
      birthDate: '1990-01-02',
      gender: 'female',
      phone: '090 123 4567',
      password: 'secret123',
      confirmPassword: 'secret123',
    });

    expect(result.user.gender).toBe('female');
    expect(repository.createRegisteredUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'member@example.test', phone: '0901234567' }),
    );
  });

  it('refreshes effective permissions from the database for an existing access token', async () => {
    repository.findUserByEmail.mockResolvedValue(user());
    const login = await service.login('member@example.test', 'secret123');
    repository.findUserById.mockResolvedValue(
      user({ roles: ['anonymous'], permissions: ['species.view.published'] }),
    );

    const payload = await service.authenticateToken(login.accessToken);

    expect(payload.roles).toEqual(['anonymous']);
    expect(payload.permissions).toEqual(['species.view.published']);
  });

  it('rotates a valid refresh token', async () => {
    repository.findSessionByRefreshTokenHash.mockResolvedValue({
      ...user(),
      sessionId: SESSION_ID,
      sessionExpiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.refresh('current-refresh-token');

    expect(result.refreshToken).not.toBe('current-refresh-token');
    expect(repository.rotateSession).toHaveBeenCalledWith(SESSION_ID, expect.any(String), expect.any(Date));
  });

  it('rejects an access token after its session is revoked', async () => {
    repository.findUserByEmail.mockResolvedValue(user());
    const login = await service.login('member@example.test', 'secret123');
    repository.findUserById.mockResolvedValue(user());
    repository.isSessionActive.mockResolvedValue(false);

    await expect(service.authenticateToken(login.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
