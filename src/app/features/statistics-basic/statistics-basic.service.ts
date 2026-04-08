import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { StatisticsBasicFilters, StatisticsBasicResponse } from './statistics-basic.models';

@Injectable({ providedIn: 'root' })
export class StatisticsBasicService {
  private readonly api = inject(ApiClientService);

  getBasicStatistics(
    tournamentId: number,
    filters: StatisticsBasicFilters
  ): Observable<StatisticsBasicResponse> {
    return this.api.get<StatisticsBasicResponse>(`/tournaments/${tournamentId}/statistics/basic`, filters);
  }
}
