import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  BasicFinancialSummary,
  FinancialMovement,
  FinancialMovementCreatePayload,
  FinancialMovementFilters,
  FinancialMovementListResponse
} from './finances-basic.models';

@Injectable({ providedIn: 'root' })
export class FinancesBasicService {
  private readonly api = inject(ApiClientService);

  getSummary(tournamentId: number): Observable<BasicFinancialSummary> {
    return this.api.get<BasicFinancialSummary>(`/tournaments/${tournamentId}/finances/summary`);
  }

  listMovements(
    tournamentId: number,
    filters: FinancialMovementFilters
  ): Observable<FinancialMovementListResponse> {
    return this.api.get<FinancialMovementListResponse>(`/tournaments/${tournamentId}/finances/movements`, filters);
  }

  createMovement(tournamentId: number, payload: FinancialMovementCreatePayload): Observable<FinancialMovement> {
    return this.api.post<FinancialMovement, FinancialMovementCreatePayload>(
      `/tournaments/${tournamentId}/finances/movements`,
      payload
    );
  }
}
