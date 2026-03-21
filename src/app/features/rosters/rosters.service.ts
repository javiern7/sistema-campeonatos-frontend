import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { RosterEntry, RosterFilters, RosterFormValue, RosterPage } from './roster.models';

@Injectable({ providedIn: 'root' })
export class RostersService {
  private readonly api = inject(ApiClientService);

  list(filters: RosterFilters): Observable<RosterPage> {
    return this.api.get<RosterPage>('/rosters', filters);
  }

  getById(id: number): Observable<RosterEntry> {
    return this.api.get<RosterEntry>(`/rosters/${id}`);
  }

  create(payload: RosterFormValue): Observable<RosterEntry> {
    return this.api.post<RosterEntry, RosterFormValue>('/rosters', payload);
  }

  update(id: number, payload: Omit<RosterFormValue, 'tournamentTeamId' | 'playerId'>): Observable<RosterEntry> {
    return this.api.put<RosterEntry, Omit<RosterFormValue, 'tournamentTeamId' | 'playerId'>>(
      `/rosters/${id}`,
      payload
    );
  }
}
