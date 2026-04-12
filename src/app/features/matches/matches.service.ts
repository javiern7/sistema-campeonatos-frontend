import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  AnnulMatchEventValue,
  MatchEvent,
  MatchEventFormValue,
  MatchFilters,
  MatchFormValue,
  MatchGame,
  MatchPage
} from './match.models';

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

  delete(id: number): Observable<void> {
    return this.api.delete(`/matches/${id}`);
  }

  listEvents(matchId: number): Observable<MatchEvent[]> {
    return this.api.get<MatchEvent[]>(`/matches/${matchId}/events`);
  }

  createEvent(matchId: number, payload: MatchEventFormValue): Observable<MatchEvent> {
    return this.api.post<MatchEvent, MatchEventFormValue>(`/matches/${matchId}/events`, payload);
  }

  updateEvent(matchId: number, eventId: number, payload: MatchEventFormValue): Observable<MatchEvent> {
    return this.api.put<MatchEvent, MatchEventFormValue>(`/matches/${matchId}/events/${eventId}`, payload);
  }

  annulEvent(matchId: number, eventId: number, payload: AnnulMatchEventValue): Observable<MatchEvent> {
    return this.api.deleteWithBody<MatchEvent, AnnulMatchEventValue>(`/matches/${matchId}/events/${eventId}`, payload);
  }
}
