import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { EventStatisticsFilters, EventStatisticsResponse } from './event-statistics.models';

@Injectable({ providedIn: 'root' })
export class EventStatisticsService {
  private readonly api = inject(ApiClientService);

  getEventStatistics(
    tournamentId: number,
    filters: EventStatisticsFilters
  ): Observable<EventStatisticsResponse> {
    return this.api.get<EventStatisticsResponse>(`/tournaments/${tournamentId}/statistics/events`, filters);
  }
}
