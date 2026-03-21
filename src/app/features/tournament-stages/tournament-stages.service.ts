import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  TournamentStage,
  TournamentStageFilters,
  TournamentStageFormValue,
  TournamentStagePage
} from './tournament-stage.models';

@Injectable({ providedIn: 'root' })
export class TournamentStagesService {
  private readonly api = inject(ApiClientService);

  list(filters: TournamentStageFilters): Observable<TournamentStagePage> {
    return this.api.get<TournamentStagePage>('/tournament-stages', filters);
  }

  getById(id: number): Observable<TournamentStage> {
    return this.api.get<TournamentStage>(`/tournament-stages/${id}`);
  }

  create(payload: TournamentStageFormValue): Observable<TournamentStage> {
    return this.api.post<TournamentStage, TournamentStageFormValue>('/tournament-stages', payload);
  }

  update(id: number, payload: Omit<TournamentStageFormValue, 'tournamentId'>): Observable<TournamentStage> {
    return this.api.put<TournamentStage, Omit<TournamentStageFormValue, 'tournamentId'>>(
      `/tournament-stages/${id}`,
      payload
    );
  }
}
