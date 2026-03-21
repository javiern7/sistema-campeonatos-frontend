import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { MatchFilters, MatchFormValue, MatchGame, MatchPage } from './match.models';

@Injectable({ providedIn: 'root' })
export class MatchesService {
  private readonly api = inject(ApiClientService);

  list(filters: MatchFilters): Observable<MatchPage> {
    return this.api.get<MatchPage>('/matches', filters);
  }

  getById(id: number): Observable<MatchGame> {
    return this.api.get<MatchGame>(`/matches/${id}`);
  }

  create(payload: MatchFormValue): Observable<MatchGame> {
    return this.api.post<MatchGame, MatchFormValue>('/matches', payload);
  }

  update(id: number, payload: Omit<MatchFormValue, 'tournamentId'>): Observable<MatchGame> {
    return this.api.put<MatchGame, Omit<MatchFormValue, 'tournamentId'>>(`/matches/${id}`, payload);
  }
}
