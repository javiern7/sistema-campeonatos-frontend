import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  Standing,
  StandingFilters,
  StandingPage,
  StandingRecalculationRequest,
  StandingRecalculationResponse
} from './standings.models';

@Injectable({ providedIn: 'root' })
export class StandingsService {
  private readonly api = inject(ApiClientService);

  list(filters: StandingFilters): Observable<StandingPage> {
    return this.api.get<StandingPage>('/standings', filters);
  }

  recalculate(payload: StandingRecalculationRequest): Observable<StandingRecalculationResponse> {
    return this.api.post<StandingRecalculationResponse, StandingRecalculationRequest>(
      '/standings/recalculate',
      payload
    );
  }
}
