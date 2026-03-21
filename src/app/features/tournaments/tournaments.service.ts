import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { Tournament, TournamentFilters, TournamentFormValue, TournamentPage } from './tournament.models';

@Injectable({ providedIn: 'root' })
export class TournamentsService {
  private readonly api = inject(ApiClientService);

  list(filters: TournamentFilters): Observable<TournamentPage> {
    return this.api.get<TournamentPage>('/tournaments', filters);
  }

  getById(id: number): Observable<Tournament> {
    return this.api.get<Tournament>(`/tournaments/${id}`);
  }

  create(payload: TournamentFormValue): Observable<Tournament> {
    return this.api.post<Tournament, TournamentFormValue>('/tournaments', payload);
  }

  update(id: number, payload: TournamentFormValue): Observable<Tournament> {
    return this.api.put<Tournament, TournamentFormValue>(`/tournaments/${id}`, payload);
  }
}
