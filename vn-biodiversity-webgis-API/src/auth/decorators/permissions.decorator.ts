import { SetMetadata } from '@nestjs/common';
import type { GovernancePermission } from '../authorization/role-permission.matrix';

export const AUTH_PERMISSIONS_KEY = 'auth_permissions';
export const Permissions = (...permissions: GovernancePermission[]) => SetMetadata(AUTH_PERMISSIONS_KEY, permissions);
