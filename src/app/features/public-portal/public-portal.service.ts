import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  PublicHome,
  PublicTournamentDetail,
  PublicTournamentListFilters,
  PublicTournamentPage,
  PublicTournamentResults,
  PublicTournamentStandings
} from './public-portal.models';

@Injectable({ providedIn: 'root' })
export class PublicPortalService {
  private readonly api = inject(ApiClientService);

  getHome(): Observable<PublicHome> {
    return this.api.get<PublicHome>('/public/home');
  }

  listTournaments(filters: PublicTournamentListFilters): Observable<PublicTournamentPage> {
    return this.api.get<PublicTournamentPage>('/public/tournaments', filters);
  }

  getTournament(slug: string): Observable<PublicTournamentDetail> {
    return this.api.get<PublicTournamentDetail>(`/public/tournaments/${slug}`);
  }

  getStandings(slug: string): Observable<PublicTournamentStandings> {
    return this.api.get<PublicTournamentStandings>(`/public/tournaments/${slug}/standings`);
  }

  getResults(slug: string): Observable<PublicTournamentResults> {
    return this.api.get<PublicTournamentResults>(`/public/tournaments/${slug}/results`);
  }
}
