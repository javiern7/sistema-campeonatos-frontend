import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { Sport } from './sport.models';

@Injectable({ providedIn: 'root' })
export class SportsService {
  private readonly api = inject(ApiClientService);

  list(activeOnly = true): Observable<Sport[]> {
    return this.api.get<Sport[]>('/sports', { activeOnly });
  }
}
