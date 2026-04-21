import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  PublicHome,
  PublicTournamentCalendar,
  PublicTournamentCalendarFilters,
  PublicTournamentContextFilters,
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

  getTournaments(filters: PublicTournamentListFilters = {}): Observable<PublicTournamentPage> {
    return this.listTournaments(filters);
  }

  getTournament(slug: string): Observable<PublicTournamentDetail> {
    return this.api.get<PublicTournamentDetail>(`/public/tournaments/${slug}`);
  }

  getCalendar(slug: string, filters: PublicTournamentCalendarFilters = {}): Observable<PublicTournamentCalendar> {
    return this.api.get<PublicTournamentCalendar>(`/public/tournaments/${slug}/calendar`, filters);
  }

  getStandings(slug: string, filters: PublicTournamentContextFilters = {}): Observable<PublicTournamentStandings> {
    return this.api.get<PublicTournamentStandings>(`/public/tournaments/${slug}/standings`, filters);
  }

  getResults(slug: string, filters: PublicTournamentContextFilters = {}): Observable<PublicTournamentResults> {
    return this.api.get<PublicTournamentResults>(`/public/tournaments/${slug}/results`, filters);
  }
}
