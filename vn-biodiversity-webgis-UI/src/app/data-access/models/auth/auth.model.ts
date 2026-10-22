export type GovernanceRole = 'administrator' | 'editor-staff' | 'registered-user' | 'anonymous';

export type GovernancePermission =
  | 'system.manage'
  | 'users.manage'
  | 'roles.manage'
  | 'data.sync'
  | 'data.import'
  | 'species.create'
  | 'species.update'
  | 'species.delete'
  | 'species.review'
  | 'species.publish'
  | 'species.view.full'
  | 'species.view.published';

export interface AdminUser {
  userId: string;
  email: string;
  displayName: string | null;
  birthDate: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  roles: GovernanceRole[];
  permissions: GovernancePermission[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  birthDate: string;
  gender: 'male' | 'female';
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  displayName: string;
  email: string;
  birthDate: string;
  gender: 'male' | 'female' | '';
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface RoleDefinition {
  code: GovernanceRole;
  label: string;
  description: string;
  isSystemRole: boolean;
  permissions: GovernancePermission[];
}

export interface PermissionDefinition {
  code: GovernancePermission;
  label: string;
  description: string;
  group: string;
}

export interface RolePermissionMatrix {
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
}
