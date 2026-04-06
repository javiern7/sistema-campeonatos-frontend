import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { OperationalActivitySummary, OperationalAuditEvent } from './operations.models';

@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly api = inject(ApiClientService);

  getRecentAuditEvents(limit = 10): Observable<OperationalAuditEvent[]> {
    return this.api.get<OperationalAuditEvent[]>('/operations/audit-events/recent', { limit });
  }

  getActivitySummary(filters?: { from?: string | null; to?: string | null }): Observable<OperationalActivitySummary> {
    return this.api.get<OperationalActivitySummary>('/operations/activity-summary', filters);
  }
}
