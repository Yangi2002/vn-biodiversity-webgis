import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UserManagementRepository } from './user-management.repository';
import { UserManagementService } from './user-management.service';

const ADMIN_ID = 'f0cd5a1b-96c5-4fb4-81f8-adf942ec88ea';
const USER_ID = '30b9f75d-60fb-4d0f-a3dd-e539675e128c';

describe('UserManagementService', () => {
  const repository = {
    list: jest.fn<UserManagementRepository['list']>(),
    findById: jest.fn<UserManagementRepository['findById']>(),
    updateStatus: jest.fn<UserManagementRepository['updateStatus']>(),
    replaceRole: jest.fn<UserManagementRepository['replaceRole']>(),
  };
  const service = new UserManagementService(repository as unknown as UserManagementRepository);
  const managedUser = {
    userId: USER_ID,
    email: 'member@example.test',
    displayName: 'Member',
    birthDate: '1990-01-02',
    gender: 'female' as const,
    phone: '0901234567',
    isActive: true,
    roles: ['registered-user' as const],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findById.mockResolvedValue(managedUser);
    repository.updateStatus.mockResolvedValue(managedUser);
    repository.replaceRole.mockResolvedValue(managedUser);
  });

  it('allows administrator to assign exactly one stored role', async () => {
    await service.updateRole(ADMIN_ID, USER_ID, 'editor-staff');

    expect(repository.replaceRole).toHaveBeenCalledWith(USER_ID, 'editor-staff');
  });

  it('does not assign anonymous as a stored account role', async () => {
    await expect(service.updateRole(ADMIN_ID, USER_ID, 'anonymous')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow assigning another administrator', async () => {
    await expect(service.updateRole(ADMIN_ID, USER_ID, 'administrator')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects multiple roles instead of silently choosing one', async () => {
    await expect(service.updateRole(ADMIN_ID, USER_ID, ['editor-staff', 'registered-user'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('prevents administrator from locking the active account itself', async () => {
    repository.findById.mockResolvedValue({ ...managedUser, userId: ADMIN_ID, roles: ['administrator'] });
    await expect(service.updateStatus(ADMIN_ID, ADMIN_ID, false)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents administrator from removing its own administrator role', async () => {
    repository.findById.mockResolvedValue({ ...managedUser, userId: ADMIN_ID, roles: ['administrator'] });
    await expect(service.updateRole(ADMIN_ID, ADMIN_ID, 'registered-user')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
