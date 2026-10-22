import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GovernanceRole } from '../auth/authorization/role-permission.matrix';

export interface ManagedUser {
  userId: string;
  email: string;
  displayName: string | null;
  birthDate: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  isActive: boolean;
  roles: GovernanceRole[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserManagementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(search: string) {
    const pattern = `%${search}%`;

    return this.prisma.$queryRaw<ManagedUser[]>`
      SELECT
        u.user_id::text AS "userId",
        u.email,
        u.display_name AS "displayName",
        u.birth_date::text AS "birthDate",
        u.gender,
        u.phone,
        u.is_active AS "isActive",
        COALESCE(array_agg(DISTINCT ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), '{}') AS roles,
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt"
      FROM app_users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      WHERE
        ${search} = ''
        OR u.email ILIKE ${pattern}
        OR COALESCE(u.display_name, '') ILIKE ${pattern}
        OR COALESCE(u.phone, '') ILIKE ${pattern}
      GROUP BY u.user_id
      ORDER BY u.created_at DESC
      LIMIT 500
    `;
  }

  async findById(userId: string): Promise<ManagedUser | null> {
    const users = await this.prisma.$queryRaw<ManagedUser[]>`
      SELECT
        u.user_id::text AS "userId",
        u.email,
        u.display_name AS "displayName",
        u.birth_date::text AS "birthDate",
        u.gender,
        u.phone,
        u.is_active AS "isActive",
        COALESCE(array_agg(DISTINCT ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), '{}') AS roles,
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt"
      FROM app_users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      WHERE u.user_id = ${userId}::uuid
      GROUP BY u.user_id
      LIMIT 1
    `;

    return users[0] ?? null;
  }

  async updateStatus(userId: string, isActive: boolean) {
    await this.prisma.$executeRaw`
      UPDATE app_users
      SET is_active = ${isActive}, updated_at = NOW()
      WHERE user_id = ${userId}::uuid
    `;

    if (!isActive) {
      await this.prisma.$executeRaw`
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE user_id = ${userId}::uuid
      `;
    }

    return this.findById(userId);
  }

  async replaceRole(userId: string, role: GovernanceRole) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        DELETE FROM user_roles
        WHERE user_id = ${userId}::uuid
      `;

      await transaction.$executeRaw`
        INSERT INTO user_roles (user_id, role_code)
        VALUES (${userId}::uuid, ${role})
      `;

      await transaction.$executeRaw`
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE user_id = ${userId}::uuid
      `;
    });

    return this.findById(userId);
  }
}
