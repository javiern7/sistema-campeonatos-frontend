import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  CompetitionFormat,
  Sport,
  SportFormValue,
  SportPosition,
  SportPositionFormValue
} from './sport.models';

@Injectable({ providedIn: 'root' })
export class SportsService {
  private readonly api = inject(ApiClientService);

  list(activeOnly = true): Observable<Sport[]> {
    return this.api.get<Sport[]>('/sports', { activeOnly });
  }

  create(payload: SportFormValue): Observable<Sport> {
    return this.api.post<Sport, SportFormValue>('/sports', payload);
  }

  update(id: number, payload: SportFormValue): Observable<Sport> {
    return this.api.put<Sport, SportFormValue>(`/sports/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.api.delete(`/sports/${id}`);
  }

  listPositions(sportId: number, activeOnly = true): Observable<SportPosition[]> {
    return this.api.get<SportPosition[]>(`/sports/${sportId}/positions`, { activeOnly });
  }

  createPosition(sportId: number, payload: SportPositionFormValue): Observable<SportPosition> {
    return this.api.post<SportPosition, SportPositionFormValue>(`/sports/${sportId}/positions`, payload);
  }

  updatePosition(
    sportId: number,
    positionId: number,
    payload: SportPositionFormValue
  ): Observable<SportPosition> {
    return this.api.put<SportPosition, SportPositionFormValue>(
      `/sports/${sportId}/positions/${positionId}`,
      payload
    );
  }

  deletePosition(sportId: number, positionId: number): Observable<void> {
    return this.api.delete(`/sports/${sportId}/positions/${positionId}`);
  }

  listCompetitionFormats(): Observable<CompetitionFormat[]> {
    return this.api.get<CompetitionFormat[]>('/sports/competition-formats');
  }
}
