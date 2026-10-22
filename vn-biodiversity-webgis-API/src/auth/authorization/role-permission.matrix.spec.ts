import { describe, expect, it } from '@jest/globals';
import {
  GOVERNANCE_ROLES,
  ROLE_DEFINITIONS,
  hasAnyRole,
  hasEveryPermission,
  normalizeRoles,
  permissionsForRoles,
} from './role-permission.matrix';

describe('role permission matrix', () => {
  it('defines the four Sprint 2 roles exactly once', () => {
    expect(ROLE_DEFINITIONS.map((role) => role.code)).toEqual(GOVERNANCE_ROLES);
    expect(new Set(ROLE_DEFINITIONS.map((role) => role.code)).size).toBe(4);
  });

  it.each([
    ['administrator', 'system.manage', true],
    ['editor-staff', 'species.update', true],
    ['editor-staff', 'species.publish', false],
    ['registered-user', 'species.view.full', true],
    ['registered-user', 'species.update', false],
    ['anonymous', 'species.view.published', true],
    ['anonymous', 'species.view.full', false],
  ] as const)('%s permission %s is %s', (role, permission, expected) => {
    expect(hasEveryPermission(permissionsForRoles([role]), [permission])).toBe(expected);
  });

  it('keeps administrator as the alias target for the legacy admin role', () => {
    expect(normalizeRoles(['admin'])).toEqual(['administrator']);
    expect(hasAnyRole(['admin'], ['administrator'])).toBe(true);
  });

  it('falls back to anonymous when no valid role exists', () => {
    expect(normalizeRoles([])).toEqual(['anonymous']);
    expect(normalizeRoles(['unknown-role'])).toEqual(['anonymous']);
  });
});
