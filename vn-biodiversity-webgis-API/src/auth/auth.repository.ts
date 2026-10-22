import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isGovernancePermission,
  isGovernanceRole,
  type GovernancePermission,
  type GovernanceRole,
} from './authorization/role-permission.matrix';
import type { RolePermissionMatrix } from './types/auth-user.type';

interface UserWithPasswordRow {
  userId: string;
  email: string;
  displayName: string | null;
  birthDate: string | null;
  gender: string | null;
  phone: string | null;
  passwordHash: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

interface SessionRow extends UserWithPasswordRow {
  sessionId: string;
  sessionExpiresAt: Date;
}

interface NewUserInput {
  email: string;
  displayName: string;
  birthDate: string;
  gender: 'male' | 'female';
  phone: string;
  passwordHash: string;
}

interface ProfileInput {
  displayName: string | null;
  email: string;
  birthDate: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  passwordHash?: string;
}

interface RolePermissionRow {
  roleCode: string;
  roleLabel: string;
  roleDescription: string | null;
  isSystemRole: boolean;
  permissionCode: string | null;
  permissionLabel: string | null;
  permissionDescription: string | null;
  permissionGroup: string | null;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<UserWithPasswordRow | null> {
    const rows = await this.prisma.$queryRaw<UserWithPasswordRow[]>`
      SELECT
        u.user_id::text AS "userId",
        u.email,
        u.display_name AS "displayName",
        u.birth_date::text AS "birthDate",
        u.gender,
        u.phone,
        u.password_hash AS "passwordHash",
        u.is_active AS "isActive",
        COALESCE(array_agg(DISTINCT ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), '{}') AS roles,
        COALESCE(array_agg(DISTINCT grp.permission_code) FILTER (WHERE grp.permission_code IS NOT NULL), '{}') AS permissions
      FROM app_users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN governance_role_permissions grp ON grp.role_code = ur.role_code
      WHERE LOWER(u.email) = LOWER(${email})
      GROUP BY u.user_id
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async findUserById(userId: string): Promise<UserWithPasswordRow | null> {
    const rows = await this.prisma.$queryRaw<UserWithPasswordRow[]>`
      SELECT
        u.user_id::text AS "userId",
        u.email,
        u.display_name AS "displayName",
        u.birth_date::text AS "birthDate",
        u.gender,
        u.phone,
        u.password_hash AS "passwordHash",
        u.is_active AS "isActive",
        COALESCE(array_agg(DISTINCT ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), '{}') AS roles,
        COALESCE(array_agg(DISTINCT grp.permission_code) FILTER (WHERE grp.permission_code IS NOT NULL), '{}') AS permissions
      FROM app_users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN governance_role_permissions grp ON grp.role_code = ur.role_code
      WHERE u.user_id = ${userId}::uuid
      GROUP BY u.user_id
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async createRegisteredUser(input: NewUserInput) {
    const userId = await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<UserWithPasswordRow[]>`
        INSERT INTO app_users (
          email,
          display_name,
          birth_date,
          gender,
          phone,
          password_hash
        )
        VALUES (
          ${input.email},
          ${input.displayName},
          ${input.birthDate}::date,
          ${input.gender},
          ${input.phone},
          ${input.passwordHash}
        )
        RETURNING
          user_id::text AS "userId",
          email,
          display_name AS "displayName",
          birth_date::text AS "birthDate",
          gender,
          phone,
          password_hash AS "passwordHash",
          is_active AS "isActive",
          ARRAY[]::text[] AS roles,
          ARRAY[]::text[] AS permissions
      `;
      const user = rows[0];

      await transaction.$executeRaw`
        INSERT INTO user_roles (user_id, role_code)
        VALUES (${user.userId}::uuid, 'registered-user')
      `;

      return user.userId;
    });

    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error('Registered user could not be loaded.');
    }

    return user;
  }

  async updateProfile(userId: string, input: ProfileInput) {
    if (input.passwordHash) {
      await this.prisma.$executeRaw`
        UPDATE app_users
        SET
          email = ${input.email},
          display_name = ${input.displayName},
          birth_date = ${input.birthDate}::date,
          gender = ${input.gender},
          phone = ${input.phone},
          password_hash = ${input.passwordHash},
          updated_at = NOW()
        WHERE user_id = ${userId}::uuid
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE app_users
        SET
          email = ${input.email},
          display_name = ${input.displayName},
          birth_date = ${input.birthDate}::date,
          gender = ${input.gender},
          phone = ${input.phone},
          updated_at = NOW()
        WHERE user_id = ${userId}::uuid
      `;
    }

    return this.findUserById(userId);
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    await this.prisma.$executeRaw`
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE
        user_id = ${userId}::uuid
        AND session_id <> ${currentSessionId}::uuid
    `;
  }

  async createSession(userId: string, refreshTokenHash: string, expiresAt: Date) {
    const rows = await this.prisma.$queryRaw<{ sessionId: string }[]>`
      INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
      VALUES (${userId}::uuid, ${refreshTokenHash}, ${expiresAt})
      RETURNING session_id::text AS "sessionId"
    `;

    return rows[0].sessionId;
  }

  async findSessionByRefreshTokenHash(refreshTokenHash: string): Promise<SessionRow | null> {
    const rows = await this.prisma.$queryRaw<SessionRow[]>`
      SELECT
        s.session_id::text AS "sessionId",
        s.expires_at AS "sessionExpiresAt",
        u.user_id::text AS "userId",
        u.email,
        u.display_name AS "displayName",
        u.birth_date::text AS "birthDate",
        u.gender,
        u.phone,
        u.password_hash AS "passwordHash",
        u.is_active AS "isActive",
        COALESCE(array_agg(DISTINCT ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), '{}') AS roles,
        COALESCE(array_agg(DISTINCT grp.permission_code) FILTER (WHERE grp.permission_code IS NOT NULL), '{}') AS permissions
      FROM auth_sessions s
      JOIN app_users u ON u.user_id = s.user_id
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN governance_role_permissions grp ON grp.role_code = ur.role_code
      WHERE
        s.refresh_token_hash = ${refreshTokenHash}
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      GROUP BY s.session_id, u.user_id
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async rotateSession(sessionId: string, refreshTokenHash: string, expiresAt: Date) {
    await this.prisma.$executeRaw`
      UPDATE auth_sessions
      SET
        refresh_token_hash = ${refreshTokenHash},
        expires_at = ${expiresAt},
        last_used_at = NOW()
      WHERE session_id = ${sessionId}::uuid AND revoked_at IS NULL
    `;
  }

  async isSessionActive(sessionId: string, userId: string) {
    const rows = await this.prisma.$queryRaw<{ active: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM auth_sessions
        WHERE
          session_id = ${sessionId}::uuid
          AND user_id = ${userId}::uuid
          AND revoked_at IS NULL
          AND expires_at > NOW()
      ) AS active
    `;

    return rows[0]?.active ?? false;
  }

  async revokeSession(sessionId: string) {
    await this.prisma.$executeRaw`
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE session_id = ${sessionId}::uuid
    `;
  }

  async rolePermissionMatrix(): Promise<RolePermissionMatrix> {
    const rows = await this.prisma.$queryRaw<RolePermissionRow[]>`
      SELECT
        r.role_code AS "roleCode",
        r.role_label AS "roleLabel",
        r.description AS "roleDescription",
        r.is_system_role AS "isSystemRole",
        p.permission_code AS "permissionCode",
        p.permission_label AS "permissionLabel",
        p.description AS "permissionDescription",
        p.permission_group AS "permissionGroup"
      FROM governance_roles r
      LEFT JOIN governance_role_permissions grp ON grp.role_code = r.role_code
      LEFT JOIN governance_permissions p ON p.permission_code = grp.permission_code
      ORDER BY
        CASE r.role_code
          WHEN 'administrator' THEN 1
          WHEN 'editor-staff' THEN 2
          WHEN 'registered-user' THEN 3
          WHEN 'anonymous' THEN 4
          ELSE 5
        END,
        p.permission_group,
        p.permission_code
    `;

    const roleMap = new Map<GovernanceRole, RolePermissionMatrix['roles'][number]>();
    const permissionMap = new Map<GovernancePermission, RolePermissionMatrix['permissions'][number]>();

    for (const row of rows) {
      if (!isGovernanceRole(row.roleCode)) {
        continue;
      }

      const role = roleMap.get(row.roleCode) ?? {
        code: row.roleCode,
        label: row.roleLabel,
        description: row.roleDescription ?? '',
        isSystemRole: row.isSystemRole,
        permissions: [],
      };

      if (row.permissionCode && isGovernancePermission(row.permissionCode)) {
        const permissionCode = row.permissionCode;
        role.permissions.push(permissionCode);
        permissionMap.set(permissionCode, {
          code: permissionCode,
          label: row.permissionLabel ?? permissionCode,
          description: row.permissionDescription ?? '',
          group: row.permissionGroup ?? 'other',
        });
      }

      roleMap.set(row.roleCode, role);
    }

    return {
      roles: Array.from(roleMap.values()),
      permissions: Array.from(permissionMap.values()),
    };
  }

  async replaceRolePermissions(roleCode: GovernanceRole, permissions: GovernancePermission[]) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        DELETE FROM governance_role_permissions
        WHERE role_code = ${roleCode}
      `;

      for (const permission of permissions) {
        await transaction.$executeRaw`
          INSERT INTO governance_role_permissions (role_code, permission_code)
          VALUES (${roleCode}, ${permission})
        `;
      }
    });
  }
}
