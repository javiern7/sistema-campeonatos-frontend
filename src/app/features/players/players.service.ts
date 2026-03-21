import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { Player, PlayerFilters, PlayerFormValue, PlayerPage } from './player.models';

@Injectable({ providedIn: 'root' })
export class PlayersService {
  private readonly api = inject(ApiClientService);

  list(filters: PlayerFilters): Observable<PlayerPage> {
    return this.api.get<PlayerPage>('/players', filters);
  }

  getById(id: number): Observable<Player> {
    return this.api.get<Player>(`/players/${id}`);
  }

  create(payload: PlayerFormValue): Observable<Player> {
    return this.api.post<Player, PlayerFormValue>('/players', payload);
  }

  update(id: number, payload: PlayerFormValue): Observable<Player> {
    return this.api.put<Player, PlayerFormValue>(`/players/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.api.delete(`/players/${id}`);
  }
}
