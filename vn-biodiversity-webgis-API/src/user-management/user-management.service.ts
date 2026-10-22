import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isGovernanceRole, type GovernanceRole } from '../auth/authorization/role-permission.matrix';
import { UserManagementRepository } from './user-management.repository';

const ASSIGNABLE_ROLES = new Set<GovernanceRole>(['editor-staff', 'registered-user']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class UserManagementService {
  constructor(private readonly repository: UserManagementRepository) {}

  list(search?: string) {
    return this.repository.list(search?.trim().slice(0, 100) ?? '');
  }

  async updateStatus(_actorUserId: string, userId: string, isActive: unknown) {
    this.assertUserId(userId);
    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('Trạng thái tài khoản không hợp lệ.');
    }
    const user = await this.requireUser(userId);
    if (!isActive && user.roles.includes('administrator')) {
      throw new ForbiddenException('Không thể khóa tài khoản Administrator hệ thống.');
    }
    return this.repository.updateStatus(userId, isActive);
  }

  async updateRole(_actorUserId: string, userId: string, value: unknown) {
    this.assertUserId(userId);
    if (typeof value !== 'string' || !isGovernanceRole(value) || !ASSIGNABLE_ROLES.has(value)) {
      throw new BadRequestException('Vai trò không hợp lệ.');
    }
    const user = await this.requireUser(userId);
    if (user.roles.includes('administrator')) {
      throw new ForbiddenException('Vai trò của Administrator hệ thống là cố định.');
    }
    return this.repository.replaceRole(userId, value);
  }

  private async requireUser(userId: string) {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản.');
    }
    return user;
  }

  private assertUserId(userId: string) {
    if (!UUID_PATTERN.test(userId)) {
      throw new BadRequestException('Mã tài khoản không hợp lệ.');
    }
  }
}
