import type { UserRole } from '../../../types/arena.ts';

/**
 * Module: Roles (src/server/modules/roles/rolesModule.ts)
 * Centralized role definitions and permission matrix.
 */

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<string>> = {
  ADMIN: new Set([
    'users:read',
    'users:write',
    'roles:manage',
    'classes:manage',
    'questions:manage',
    'quiz:manage',
    'rooms:host',
    'rooms:join',
    'rooms:test_mode',
    'leaderboard:read',
    'reports:read',
    'admin:access',
  ]),
  TEACHER: new Set([
    'classes:manage',
    'questions:manage',
    'quiz:manage',
    'rooms:host',
    'rooms:join',
    'rooms:test_mode',
    'leaderboard:read',
    'reports:read',
  ]),
  STUDENT: new Set([
    'classes:join',
    'rooms:join',
    'rooms:test_mode',
    'leaderboard:read',
  ]),
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
