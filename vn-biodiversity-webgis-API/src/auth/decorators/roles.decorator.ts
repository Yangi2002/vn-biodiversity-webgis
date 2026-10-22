import { SetMetadata } from '@nestjs/common';
import type { GovernanceRole } from '../authorization/role-permission.matrix';

export const AUTH_ROLES_KEY = 'auth_roles';
export const Roles = (...roles: GovernanceRole[]) => SetMetadata(AUTH_ROLES_KEY, roles);
