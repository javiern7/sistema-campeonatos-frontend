import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  CompetitionAdvancedBracketResponse,
  CompetitionAdvancedCalendarFilters,
  CompetitionAdvancedCalendarResponse,
  CompetitionAdvancedResultsFilters,
  CompetitionAdvancedResultsResponse
} from './competition-advanced.models';

@Injectable({ providedIn: 'root' })
export class CompetitionAdvancedService {
  private readonly api = inject(ApiClientService);

  getBracket(tournamentId: number, stageId?: number | ''): Observable<CompetitionAdvancedBracketResponse> {
    return this.api.get<CompetitionAdvancedBracketResponse>(
      `/tournaments/${tournamentId}/competition-advanced/bracket`,
      { stageId }
    );
  }

  getCalendar(
    tournamentId: number,
    filters: CompetitionAdvancedCalendarFilters
  ): Observable<CompetitionAdvancedCalendarResponse> {
    return this.api.get<CompetitionAdvancedCalendarResponse>(
      `/tournaments/${tournamentId}/competition-advanced/calendar`,
      filters
    );
  }

  getResults(
    tournamentId: number,
    filters: CompetitionAdvancedResultsFilters
  ): Observable<CompetitionAdvancedResultsResponse> {
    return this.api.get<CompetitionAdvancedResultsResponse>(
      `/tournaments/${tournamentId}/competition-advanced/results`,
      filters
    );
  }

  progressToKnockout(tournamentId: number): Observable<unknown> {
    return this.api.post<unknown, Record<string, never>>(`/tournaments/${tournamentId}/progress-to-knockout`, {});
  }

  generateKnockoutBracket(tournamentId: number): Observable<unknown> {
    return this.api.post<unknown, Record<string, never>>(
      `/tournaments/${tournamentId}/generate-knockout-bracket`,
      {}
    );
  }
}
