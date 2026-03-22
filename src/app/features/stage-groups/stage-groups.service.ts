import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { StageGroup, StageGroupFilters, StageGroupFormValue, StageGroupPage } from './stage-group.models';

@Injectable({ providedIn: 'root' })
export class StageGroupsService {
  private readonly api = inject(ApiClientService);

  list(filters: StageGroupFilters): Observable<StageGroupPage> {
    return this.api.get<StageGroupPage>('/stage-groups', filters);
  }

  getById(id: number): Observable<StageGroup> {
    return this.api.get<StageGroup>(`/stage-groups/${id}`);
  }

  create(payload: StageGroupFormValue): Observable<StageGroup> {
    return this.api.post<StageGroup, StageGroupFormValue>('/stage-groups', payload);
  }

  update(id: number, payload: Omit<StageGroupFormValue, 'stageId'>): Observable<StageGroup> {
    return this.api.put<StageGroup, Omit<StageGroupFormValue, 'stageId'>>(`/stage-groups/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.api.delete(`/stage-groups/${id}`);
  }
}
