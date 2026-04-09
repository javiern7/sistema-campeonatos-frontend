import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  DisciplineMatchResponse,
  DisciplinaryIncident,
  DisciplinaryIncidentCreateRequest,
  DisciplinarySanction,
  DisciplinarySanctionCreateRequest,
  DisciplinarySanctionFilters,
  DisciplinarySanctionListResponse
} from './discipline.models';

@Injectable({ providedIn: 'root' })
export class DisciplineService {
  private readonly api = inject(ApiClientService);

  getMatchDiscipline(matchId: number): Observable<DisciplineMatchResponse> {
    return this.api.get<DisciplineMatchResponse>(`/matches/${matchId}/discipline`);
  }

  createIncident(matchId: number, payload: DisciplinaryIncidentCreateRequest): Observable<DisciplinaryIncident> {
    return this.api.post<DisciplinaryIncident, DisciplinaryIncidentCreateRequest>(
      `/matches/${matchId}/discipline/incidents`,
      payload
    );
  }

  createSanction(
    matchId: number,
    incidentId: number,
    payload: DisciplinarySanctionCreateRequest
  ): Observable<DisciplinarySanction> {
    return this.api.post<DisciplinarySanction, DisciplinarySanctionCreateRequest>(
      `/matches/${matchId}/discipline/incidents/${incidentId}/sanctions`,
      payload
    );
  }

  listTournamentSanctions(
    tournamentId: number,
    filters: DisciplinarySanctionFilters
  ): Observable<DisciplinarySanctionListResponse> {
    return this.api.get<DisciplinarySanctionListResponse>(
      `/tournaments/${tournamentId}/discipline/sanctions`,
      filters
    );
  }
}
