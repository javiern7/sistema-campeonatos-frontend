import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  TournamentTeam,
  TournamentTeamFilters,
  TournamentTeamFormValue,
  TournamentTeamPage
} from './tournament-team.models';

@Injectable({ providedIn: 'root' })
export class TournamentTeamsService {
  private readonly api = inject(ApiClientService);

  list(filters: TournamentTeamFilters): Observable<TournamentTeamPage> {
    return this.api.get<TournamentTeamPage>('/tournament-teams', filters);
  }

  getById(id: number): Observable<TournamentTeam> {
    return this.api.get<TournamentTeam>(`/tournament-teams/${id}`);
  }

  create(payload: TournamentTeamFormValue): Observable<TournamentTeam> {
    return this.api.post<TournamentTeam, TournamentTeamFormValue>('/tournament-teams', payload);
  }

  update(id: number, payload: Omit<TournamentTeamFormValue, 'tournamentId' | 'teamId'>): Observable<TournamentTeam> {
    return this.api.put<TournamentTeam, Omit<TournamentTeamFormValue, 'tournamentId' | 'teamId'>>(
      `/tournament-teams/${id}`,
      payload
    );
  }
}
