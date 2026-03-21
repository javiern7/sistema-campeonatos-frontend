import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import { PlayersService } from '../players/players.service';
import { SportsService } from '../sports/sports.service';
import { TeamsService } from '../teams/teams.service';
import { DashboardSummary } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly sportsService = inject(SportsService);
  private readonly teamsService = inject(TeamsService);
  private readonly playersService = inject(PlayersService);

  getSummary(): Observable<DashboardSummary> {
    return forkJoin({
      sports: this.sportsService.list(true),
      teams: this.teamsService.list({ page: 0, size: 1 }),
      players: this.playersService.list({ page: 0, size: 1 })
    }).pipe(
      map(({ sports, teams, players }) => ({
        sportCount: sports.length,
        teamCount: teams.totalElements,
        playerCount: players.totalElements
      }))
    );
  }
}
