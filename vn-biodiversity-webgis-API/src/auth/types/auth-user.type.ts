import type { GovernancePermission, GovernanceRole } from '../authorization/role-permission.matrix';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string | null;
  birthDate: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  roles: GovernanceRole[];
  permissions: GovernancePermission[];
}

export interface AuthTokenPayload {
  sub: string;
  sid: string;
  email: string;
  roles: GovernanceRole[];
  permissions: GovernancePermission[];
  exp: number;
}

export interface PermissionDefinition {
  code: GovernancePermission;
  label: string;
  description: string;
  group: string;
}

export interface RolePermissionDefinition {
  code: GovernanceRole;
  label: string;
  description: string;
  isSystemRole: boolean;
  permissions: GovernancePermission[];
}

export interface RolePermissionMatrix {
  roles: RolePermissionDefinition[];
  permissions: PermissionDefinition[];
}
