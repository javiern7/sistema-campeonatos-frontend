import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  Standing,
  StandingFilters,
  StandingFormValue,
  StandingPage,
  StandingRecalculationRequest,
  StandingRecalculationResponse,
  StandingUpdateValue
} from './standings.models';

@Injectable({ providedIn: 'root' })
export class StandingsService {
  private readonly api = inject(ApiClientService);

  list(filters: StandingFilters): Observable<StandingPage> {
    return this.api.get<StandingPage>('/standings', filters);
  }

  getById(id: number): Observable<Standing> {
    return this.api.get<Standing>(`/standings/${id}`);
  }

  create(payload: StandingFormValue): Observable<Standing> {
    return this.api.post<Standing, StandingFormValue>('/standings', payload);
  }

  update(id: number, payload: StandingUpdateValue): Observable<Standing> {
    return this.api.put<Standing, StandingUpdateValue>(`/standings/${id}`, payload);
  }

  recalculate(payload: StandingRecalculationRequest): Observable<StandingRecalculationResponse> {
    return this.api.post<StandingRecalculationResponse, StandingRecalculationRequest>(
      '/standings/recalculate',
      payload
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete(`/standings/${id}`);
  }
}
