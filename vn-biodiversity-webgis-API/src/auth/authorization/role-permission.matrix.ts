export const GOVERNANCE_ROLES = [
  'administrator',
  'editor-staff',
  'registered-user',
  'anonymous',
] as const;

export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

export const GOVERNANCE_PERMISSIONS = [
  'system.manage',
  'users.manage',
  'roles.manage',
  'data.sync',
  'data.import',
  'species.create',
  'species.update',
  'species.delete',
  'species.review',
  'species.publish',
  'species.view.full',
  'species.view.published',
] as const;

export type GovernancePermission = (typeof GOVERNANCE_PERMISSIONS)[number];

export interface RoleDefinition {
  code: GovernanceRole;
  label: string;
  description: string;
  permissions: GovernancePermission[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    code: 'administrator',
    label: 'Administrator',
    description: 'Quản trị toàn hệ thống, cấu hình, đồng bộ dữ liệu và duyệt thay đổi.',
    permissions: [
      'system.manage',
      'users.manage',
      'roles.manage',
      'data.sync',
      'data.import',
      'species.create',
      'species.update',
      'species.delete',
      'species.review',
      'species.publish',
      'species.view.full',
      'species.view.published',
    ],
  },
  {
    code: 'editor-staff',
    label: 'Editor Staff',
    description: 'Upload Excel/CSV, thêm mới và chỉnh sửa dữ liệu theo quyền được cấp.',
    permissions: ['data.import', 'species.create', 'species.update', 'species.view.full', 'species.view.published'],
  },
  {
    code: 'registered-user',
    label: 'Registered User',
    description: 'Đăng nhập, tìm kiếm và xem đầy đủ dữ liệu loài được phép công bố.',
    permissions: ['species.view.full', 'species.view.published'],
  },
  {
    code: 'anonymous',
    label: 'Anonymous',
    description: 'Truy cập công khai, chỉ xem dữ liệu đã công bố trên WebGIS.',
    permissions: ['species.view.published'],
  },
];

const ROLE_SET = new Set<string>(GOVERNANCE_ROLES);
const PERMISSION_BY_ROLE = new Map(ROLE_DEFINITIONS.map((role) => [role.code, role.permissions]));

export function isGovernanceRole(role: string): role is GovernanceRole {
  return ROLE_SET.has(role);
}

export function permissionsForRoles(roles: readonly string[]) {
  const effectiveRoles = normalizeRoles(roles);
  const permissions = new Set<GovernancePermission>();

  for (const role of effectiveRoles) {
    for (const permission of PERMISSION_BY_ROLE.get(role) ?? []) {
      permissions.add(permission);
    }
  }

  return Array.from(permissions).sort();
}

export function normalizeRoles(roles: readonly string[]): GovernanceRole[] {
  const normalizedRoles = new Set<GovernanceRole>();

  for (const role of roles) {
    if (role === 'admin') {
      normalizedRoles.add('administrator');
      continue;
    }

    if (isGovernanceRole(role)) {
      normalizedRoles.add(role);
    }
  }

  if (!normalizedRoles.size) {
    normalizedRoles.add('anonymous');
  }

  return Array.from(normalizedRoles);
}

export function hasAnyRole(userRoles: readonly string[], requiredRoles: readonly string[]) {
  if (!requiredRoles.length) {
    return true;
  }

  const effectiveRoles = new Set(normalizeRoles(userRoles));

  return normalizeRoles(requiredRoles).some((role) => effectiveRoles.has(role));
}
