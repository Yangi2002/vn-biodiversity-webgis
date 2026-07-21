import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface UserWithPasswordRow {
  userId: string;
  email: string;
  displayName: string | null;
  passwordHash: string;
  isActive: boolean;
  roles: string[];
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    const rows = await this.prisma.$queryRaw<UserWithPasswordRow[]>`
      SELECT
        u.user_id::text AS "userId",
        u.email,
        u.display_name AS "displayName",
        u.password_hash AS "passwordHash",
        u.is_active AS "isActive",
        COALESCE(array_agg(ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), '{}') AS roles
      FROM app_users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      WHERE LOWER(u.email) = LOWER(${email})
      GROUP BY u.user_id
      LIMIT 1
    `;

    return rows[0] ?? null;
  }
}
