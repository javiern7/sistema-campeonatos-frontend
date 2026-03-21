import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { Team, TeamFilters, TeamFormValue, TeamPage } from './team.models';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly api = inject(ApiClientService);

  list(filters: TeamFilters): Observable<TeamPage> {
    return this.api.get<TeamPage>('/teams', filters);
  }

  getById(id: number): Observable<Team> {
    return this.api.get<Team>(`/teams/${id}`);
  }

  create(payload: TeamFormValue): Observable<Team> {
    return this.api.post<Team, TeamFormValue>('/teams', payload);
  }

  update(id: number, payload: TeamFormValue): Observable<Team> {
    return this.api.put<Team, TeamFormValue>(`/teams/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.api.delete(`/teams/${id}`);
  }
}
