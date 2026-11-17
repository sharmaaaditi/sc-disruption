export const roles = ['VIEWER', 'ANALYST', 'ADMIN'] as const;
export type Role = (typeof roles)[number];

export type Capability = 'VIEW_NETWORK' | 'VIEW_RESULTS' | 'RUN_SIMULATION' | 'MANAGE_ROLES';

const grants: Record<Role, ReadonlySet<Capability>> = {
  VIEWER: new Set(['VIEW_NETWORK', 'VIEW_RESULTS']),
  ANALYST: new Set(['VIEW_NETWORK', 'VIEW_RESULTS', 'RUN_SIMULATION']),
  ADMIN: new Set(['VIEW_NETWORK', 'VIEW_RESULTS', 'RUN_SIMULATION', 'MANAGE_ROLES']),
};

export function can(role: Role | null, capability: Capability) {
  return role ? grants[role].has(capability) : false;
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roles.includes(value as Role);
}
