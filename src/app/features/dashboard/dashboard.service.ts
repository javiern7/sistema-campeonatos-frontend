import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import { MatchesService } from '../matches/matches.service';
import { PlayersService } from '../players/players.service';
import { RostersService } from '../rosters/rosters.service';
import { SportsService } from '../sports/sports.service';
import { StandingsService } from '../standings/standings.service';
import { TeamsService } from '../teams/teams.service';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { DashboardSummary } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly sportsService = inject(SportsService);
  private readonly teamsService = inject(TeamsService);
  private readonly playersService = inject(PlayersService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly rostersService = inject(RostersService);
  private readonly matchesService = inject(MatchesService);
  private readonly standingsService = inject(StandingsService);

  getSummary(): Observable<DashboardSummary> {
    return forkJoin({
      sports: this.sportsService.list(true),
      teams: this.teamsService.list({ page: 0, size: 1 }),
      players: this.playersService.list({ page: 0, size: 1 }),
      tournaments: this.tournamentsService.list({ page: 0, size: 1 }),
      registrations: this.tournamentTeamsService.list({ page: 0, size: 1 }),
      activeRosters: this.rostersService.list({ rosterStatus: 'ACTIVE', page: 0, size: 1 }),
      matches: this.matchesService.list({ page: 0, size: 1 }),
      standings: this.standingsService.list({ page: 0, size: 1 })
    }).pipe(
      map(({ sports, teams, players, tournaments, registrations, activeRosters, matches, standings }) => ({
        sportCount: sports.length,
        teamCount: teams.totalElements,
        playerCount: players.totalElements,
        tournamentCount: tournaments.totalElements,
        registrationCount: registrations.totalElements,
        activeRosterCount: activeRosters.totalElements,
        matchCount: matches.totalElements,
        standingsCount: standings.totalElements
      }))
    );
  }
}
