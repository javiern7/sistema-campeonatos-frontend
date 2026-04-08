export type OperationalAuditResult = 'SUCCESS' | 'DENIED' | 'FAILED';

export interface OperationalAuditEvent {
  id: number;
  actorUserId: number | null;
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  result: OperationalAuditResult;
  context: Record<string, unknown>;
}

export interface OperationalActionCount {
  action: string;
  total: number;
}

export interface OperationalActivitySummary {
  from: string | null;
  to: string | null;
  totalEvents: number;
  successEvents: number;
  deniedEvents: number;
  failedEvents: number;
  uniqueActors: number;
  topActions: OperationalActionCount[];
}

export interface ManagedPermission {
  code: string;
  name: string;
  description: string;
}

export interface ManagedRolePermission {
  roleCode: string;
  roleName: string;
  mutable: boolean;
  permissionCodes: string[];
}

export interface PermissionGovernanceSummary {
  generatedAt: string;
  writeEnabled: boolean;
  mutableRoles: string[];
  availablePermissions: ManagedPermission[];
  roles: ManagedRolePermission[];
}

export interface RolePermissionUpdateRequest {
  permissionCodes: string[];
  reason: string;
}
