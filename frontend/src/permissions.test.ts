import {describe, expect, it} from 'vitest';
import {can, isRole, roles} from './permissions';

describe('role permissions', () => {
  it('lets every verified role inspect networks and results', () => {
    for (const role of roles) {
      expect(can(role, 'VIEW_NETWORK')).toBe(true);
      expect(can(role, 'VIEW_RESULTS')).toBe(true);
    }
  });

  it('keeps simulation actions away from viewers', () => {
    expect(can('VIEWER', 'RUN_SIMULATION')).toBe(false);
    expect(can('ANALYST', 'RUN_SIMULATION')).toBe(true);
    expect(can('ADMIN', 'RUN_SIMULATION')).toBe(true);
  });

  it('reserves role management for administrators', () => {
    expect(can('VIEWER', 'MANAGE_ROLES')).toBe(false);
    expect(can('ANALYST', 'MANAGE_ROLES')).toBe(false);
    expect(can('ADMIN', 'MANAGE_ROLES')).toBe(true);
  });

  it('fails closed for missing or invalid identities', () => {
    expect(can(null, 'VIEW_NETWORK')).toBe(false);
    expect(isRole('OWNER')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
