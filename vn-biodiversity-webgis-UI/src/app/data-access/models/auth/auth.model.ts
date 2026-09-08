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
  roles: GovernanceRole[];
  permissions: GovernancePermission[];
}

export interface LoginResponse {
  accessToken: string;
  user: AdminUser;
}

export interface RoleDefinition {
  code: GovernanceRole;
  label: string;
  description: string;
  permissions: GovernancePermission[];
}
