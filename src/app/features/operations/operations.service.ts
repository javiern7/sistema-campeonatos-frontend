import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  ManagedRolePermission,
  OperationalActivitySummary,
  OperationalAuditEvent,
  PermissionGovernanceSummary,
  RolePermissionUpdateRequest
} from './operations.models';

@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly api = inject(ApiClientService);

  getRecentAuditEvents(limit = 10): Observable<OperationalAuditEvent[]> {
    return this.api.get<OperationalAuditEvent[]>('/operations/audit-events/recent', { limit });
  }

  getActivitySummary(filters?: { from?: string | null; to?: string | null }): Observable<OperationalActivitySummary> {
    return this.api.get<OperationalActivitySummary>('/operations/activity-summary', filters);
  }

  getPermissionGovernanceSummary(): Observable<PermissionGovernanceSummary> {
    return this.api.get<PermissionGovernanceSummary>('/operations/permission-governance/roles');
  }

  updateRolePermissions(roleCode: string, request: RolePermissionUpdateRequest): Observable<ManagedRolePermission> {
    return this.api.put<ManagedRolePermission, RolePermissionUpdateRequest>(
      `/operations/permission-governance/roles/${encodeURIComponent(roleCode)}`,
      request
    );
  }
}
