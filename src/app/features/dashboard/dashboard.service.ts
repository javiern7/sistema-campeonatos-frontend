import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { MatchGame } from '../matches/match.models';
import { MatchesService } from '../matches/matches.service';
import { PlayersService } from '../players/players.service';
import { RosterEntry } from '../rosters/roster.models';
import { RostersService } from '../rosters/rosters.service';
import { Sport } from '../sports/sport.models';
import { SportsService } from '../sports/sports.service';
import { Standing } from '../standings/standings.models';
import { StandingsService } from '../standings/standings.service';
import { StageGroup } from '../stage-groups/stage-group.models';
import { StageGroupsService } from '../stage-groups/stage-groups.service';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentStage } from '../tournament-stages/tournament-stage.models';
import { TournamentStagesService } from '../tournament-stages/tournament-stages.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import {
  DashboardAlert,
  DashboardAuditStatus,
  DashboardHealth,
  DashboardReportingSegment,
  DashboardSportSummary,
  DashboardSummary,
  DashboardTournamentSummary
} from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly sportsService = inject(SportsService);
  private readonly teamsService = inject(TeamsService);
  private readonly playersService = inject(PlayersService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly tournamentStagesService = inject(TournamentStagesService);
  private readonly stageGroupsService = inject(StageGroupsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly rostersService = inject(RostersService);
  private readonly matchesService = inject(MatchesService);
  private readonly standingsService = inject(StandingsService);

  getSummary(): Observable<DashboardSummary> {
    return forkJoin({
      sports: this.sportsService.list(false),
      teams: this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })),
      players: this.playersService.list({ page: 0, size: 1 }),
      tournaments: this.catalogLoader.loadAll((page, size) => this.tournamentsService.list({ page, size })),
      stages: this.catalogLoader.loadAll((page, size) => this.tournamentStagesService.list({ page, size })),
      groups: this.catalogLoader.loadAll((page, size) => this.stageGroupsService.list({ page, size })),
      registrations: this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ page, size })),
      rosters: this.catalogLoader.loadAll((page, size) => this.rostersService.list({ page, size })),
      matches: this.catalogLoader.loadAll((page, size) => this.matchesService.list({ page, size })),
      standings: this.catalogLoader.loadAll((page, size) => this.standingsService.list({ page, size }))
    }).pipe(map((data) => this.buildSummary(data)));
  }

  private buildSummary(data: {
    sports: Sport[];
    teams: Team[];
    players: { totalElements: number };
    tournaments: Tournament[];
    stages: TournamentStage[];
    groups: StageGroup[];
    registrations: TournamentTeam[];
    rosters: RosterEntry[];
    matches: MatchGame[];
    standings: Standing[];
  }): DashboardSummary {
    const { sports, teams, players, tournaments, stages, groups, registrations, rosters, matches, standings } = data;
    const sportById = new Map(sports.map((sport) => [sport.id, sport]));
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const registrationById = new Map(registrations.map((registration) => [registration.id, registration]));

    const tournamentSummaries = tournaments
      .map((tournament) =>
        this.buildTournamentSummary({
          tournament,
          sportById,
          teamById,
          registrationById,
          stages,
          groups,
          registrations,
          rosters,
          matches,
          standings
        })
      )
      .sort((left, right) => {
        const healthDiff = this.healthPriority(right.health) - this.healthPriority(left.health);
        if (healthDiff !== 0) {
          return healthDiff;
        }

        return left.tournamentName.localeCompare(right.tournamentName, 'es');
      });

    const alerts = tournamentSummaries
      .filter((summary) => summary.health !== 'healthy')
      .map((summary) => this.toAlert(summary));

    const sportSummaries = sports
      .map((sport) => this.buildSportSummary(sport, tournamentSummaries))
      .sort((left, right) => {
        const healthDiff = this.healthPriority(right.health) - this.healthPriority(left.health);
        if (healthDiff !== 0) {
          return healthDiff;
        }

        return left.sportName.localeCompare(right.sportName, 'es');
      });

    return {
      sportCount: sports.length,
      teamCount: teams.length,
      playerCount: players.totalElements,
      tournamentCount: tournaments.length,
      activeTournamentCount: tournaments.filter((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS').length,
      liveTournamentCount: tournaments.filter((item) => item.status === 'IN_PROGRESS').length,
      operationalTournamentCount: tournamentSummaries.filter((item) => item.reportingSegment === 'operational').length,
      setupTournamentCount: tournamentSummaries.filter((item) => item.reportingSegment === 'setup').length,
      sandboxTournamentCount: tournamentSummaries.filter((item) => item.reportingSegment === 'sandbox').length,
      registrationCount: registrations.length,
      approvedRegistrationCount: registrations.filter((item) => item.registrationStatus === 'APPROVED').length,
      matchCount: matches.length,
      playedMatchCount: matches.filter((item) => item.status === 'PLAYED').length,
      scheduledMatchCount: matches.filter((item) => item.status === 'SCHEDULED').length,
      activeRosterCount: rosters.filter((item) => item.rosterStatus === 'ACTIVE').length,
      standingsCount: standings.length,
      attentionTournamentCount: tournamentSummaries.filter((item) => item.health !== 'healthy').length,
      rosterGapTournamentCount: tournamentSummaries.filter((item) => item.rosterGapCount > 0).length,
      standingsGapTournamentCount: tournamentSummaries.filter(
        (item) => item.playedMatchCount > 0 && item.standingsCount === 0
      ).length,
      readyTournamentCount: tournamentSummaries.filter((item) => item.auditStatus === 'ready').length,
      sportSummaries,
      tournamentSummaries,
      alerts
    };
  }

  private buildTournamentSummary(input: {
    tournament: Tournament;
    sportById: Map<number, Sport>;
    teamById: Map<number, Team>;
    registrationById: Map<number, TournamentTeam>;
    stages: TournamentStage[];
    groups: StageGroup[];
    registrations: TournamentTeam[];
    rosters: RosterEntry[];
    matches: MatchGame[];
    standings: Standing[];
  }): DashboardTournamentSummary {
    const { tournament, sportById, teamById, registrationById, stages, groups, registrations, rosters, matches, standings } =
      input;
    const tournamentStages = stages.filter((item) => item.tournamentId === tournament.id);
    const stageIds = new Set(tournamentStages.map((item) => item.id));
    const tournamentGroups = groups.filter((item) => stageIds.has(item.stageId));
    const tournamentRegistrations = registrations.filter((item) => item.tournamentId === tournament.id);
    const approvedTournamentRegistrations = tournamentRegistrations.filter((item) => item.registrationStatus === 'APPROVED');
    const registrationIds = new Set(tournamentRegistrations.map((item) => item.id));
    const tournamentRosters = rosters.filter((item) => registrationIds.has(item.tournamentTeamId));
    const activeRosterRegistrationIds = new Set(
      tournamentRosters.filter((item) => item.rosterStatus === 'ACTIVE').map((item) => item.tournamentTeamId)
    );
    const tournamentMatches = matches.filter((item) => item.tournamentId === tournament.id);
    const tournamentStandings = standings.filter((item) => item.tournamentId === tournament.id);
    const standingTournamentTeamIds = new Set(tournamentStandings.map((item) => item.tournamentTeamId));
    const leaderStanding = [...tournamentStandings].sort((left, right) => {
      const leftRank = left.rankPosition ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.rankPosition ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return right.points - left.points;
    })[0];
    const leaderRegistration = leaderStanding ? registrationById.get(leaderStanding.tournamentTeamId) : null;
    const leaderTeam = leaderRegistration ? teamById.get(leaderRegistration.teamId) : null;
    const registrationsWithActiveRosterCount = approvedTournamentRegistrations.filter((item) =>
      activeRosterRegistrationIds.has(item.id)
    ).length;
    const standingsCoverageCount = approvedTournamentRegistrations.filter((item) =>
      standingTournamentTeamIds.has(item.id)
    ).length;
    const rosterGapCount = Math.max(approvedTournamentRegistrations.length - registrationsWithActiveRosterCount, 0);
    const reportingSegment = this.resolveReportingSegment({
      tournament,
      approvedRegistrationCount: approvedTournamentRegistrations.length,
      activeRosterCount: tournamentRosters.filter((item) => item.rosterStatus === 'ACTIVE').length,
      matchCount: tournamentMatches.length,
      standingsCount: tournamentStandings.length
    });
    const qaSignal = this.hasQaSignal(tournament);
    const summaryBase = {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      sportName: sportById.get(tournament.sportId)?.name ?? `Deporte ${tournament.sportId}`,
      status: tournament.status,
      reportingSegment,
      qaSignal,
      stageCount: tournamentStages.length,
      groupCount: tournamentGroups.length,
      registrationCount: tournamentRegistrations.length,
      approvedRegistrationCount: approvedTournamentRegistrations.length,
      registrationsWithActiveRosterCount,
      rosterGapCount,
      activeRosterCount: tournamentRosters.filter((item) => item.rosterStatus === 'ACTIVE').length,
      matchCount: tournamentMatches.length,
      playedMatchCount: tournamentMatches.filter((item) => item.status === 'PLAYED').length,
      scheduledMatchCount: tournamentMatches.filter((item) => item.status === 'SCHEDULED').length,
      incidentMatchCount: tournamentMatches.filter((item) => item.status === 'FORFEIT' || item.status === 'CANCELLED').length,
      standingsCount: tournamentStandings.length,
      standingsCoverageCount,
      leaderName: leaderTeam?.name ?? null,
      leaderPoints: leaderStanding?.points ?? null
    };
    const evaluation = this.evaluateTournament(summaryBase);

    return {
      ...summaryBase,
      health: evaluation.health,
      readinessScore: evaluation.readinessScore,
      auditStatus: evaluation.auditStatus,
      auditMessage: evaluation.auditMessage,
      blockers: evaluation.blockers,
      nextAction: evaluation.nextAction
    };
  }

  private buildSportSummary(
    sport: Sport,
    tournamentSummaries: DashboardTournamentSummary[]
  ): DashboardSportSummary {
    const summaries = tournamentSummaries.filter((item) => item.sportName === sport.name);
    const attentionCount = summaries.filter((item) => item.health === 'attention').length;
    const warningCount = summaries.filter((item) => item.health === 'warning').length;

    return {
      sportId: sport.id,
      sportName: sport.name,
      tournamentCount: summaries.length,
      liveTournamentCount: summaries.filter((item) => item.status === 'IN_PROGRESS').length,
      registrationCount: summaries.reduce((total, item) => total + item.registrationCount, 0),
      approvedRegistrationCount: summaries.reduce((total, item) => total + item.approvedRegistrationCount, 0),
      activeRosterCount: summaries.reduce((total, item) => total + item.activeRosterCount, 0),
      matchCount: summaries.reduce((total, item) => total + item.matchCount, 0),
      playedMatchCount: summaries.reduce((total, item) => total + item.playedMatchCount, 0),
      standingsCount: summaries.reduce((total, item) => total + item.standingsCount, 0),
      alertCount: attentionCount + warningCount,
      health: attentionCount > 0 ? 'attention' : warningCount > 0 ? 'warning' : 'healthy',
      healthMessage:
        summaries.length === 0
          ? 'Aun no tiene torneos operativos en frontend.'
          : attentionCount > 0
            ? 'Tiene torneos que requieren accion inmediata para sostener la trazabilidad.'
            : warningCount > 0
              ? 'Ya tiene base competitiva, pero aun faltan pasos para cerrar el flujo operativo.'
              : 'Muestra continuidad entre torneo, inscripciones, rosters, partidos y standings.'
    };
  }

  private evaluateTournament(summary: Omit<DashboardTournamentSummary, 'health' | 'nextAction' | 'readinessScore' | 'auditStatus' | 'auditMessage' | 'blockers'>): {
    health: DashboardHealth;
    readinessScore: number;
    auditStatus: DashboardAuditStatus;
    auditMessage: string;
    blockers: string[];
    nextAction: string;
  } {
    const blockers: string[] = [];
    let readinessScore = 0;

    if (summary.approvedRegistrationCount > 0) {
      readinessScore += 25;
    }
    if (summary.registrationsWithActiveRosterCount === summary.approvedRegistrationCount && summary.approvedRegistrationCount > 0) {
      readinessScore += 25;
    } else if (summary.registrationsWithActiveRosterCount > 0) {
      readinessScore += 10;
    }
    if (summary.matchCount > 0) {
      readinessScore += 25;
    }
    if (summary.standingsCount > 0) {
      readinessScore += 25;
    }

    if (summary.registrationCount === 0) {
      blockers.push('Sin inscripciones');
    }
    if (summary.approvedRegistrationCount > 0 && summary.rosterGapCount > 0) {
      blockers.push(`${summary.rosterGapCount} inscripciones aprobadas sin roster activo`);
    }
    if (summary.approvedRegistrationCount > 1 && summary.matchCount === 0) {
      blockers.push('Sin fixture cargado');
    }
    if (summary.playedMatchCount > 0 && summary.standingsCount === 0) {
      blockers.push('Resultados sin standings');
    }
    if (summary.playedMatchCount > 0 && summary.registrationsWithActiveRosterCount === 0) {
      blockers.push('Partidos jugados sin soporte de roster');
    }
    if (summary.reportingSegment === 'sandbox') {
      blockers.push('Torneo QA o borrador fuera del foco ejecutivo principal');
    }

    const auditStatus: DashboardAuditStatus =
      summary.reportingSegment === 'sandbox'
        ? 'partial'
        : blockers.some((item) =>
              item === 'Sin inscripciones' ||
              item.includes('sin roster activo') ||
              item === 'Resultados sin standings' ||
              item === 'Partidos jugados sin soporte de roster'
            )
          ? 'blocked'
          : blockers.length > 0
            ? 'partial'
            : 'ready';

    const auditMessage =
      auditStatus === 'ready'
        ? 'El torneo ya sostiene continuidad visible entre inscripciones, roster, partidos y standings.'
        : auditStatus === 'blocked'
          ? 'La continuidad competitiva esta interrumpida y conviene corregir la base antes de seguir escalando operacion.'
          : summary.reportingSegment === 'sandbox'
            ? 'Este torneo hoy funciona mas como ruido de QA o borrador que como referencia ejecutiva principal.'
            : 'El torneo ya avanzo, pero todavia necesita uno o mas cierres para consolidar su trazabilidad.';

    if (summary.reportingSegment === 'sandbox') {
      return {
        health: 'warning',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction:
          'Conviene separar este torneo del radar ejecutivo principal y decidir si se depura, se mantiene como QA o se transforma en operacion real.'
      };
    }

    if (summary.playedMatchCount > 0 && summary.activeRosterCount === 0 && summary.standingsCount === 0) {
      return {
        health: 'attention',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: 'Ya hay resultados cargados, pero faltan rosters activos y tabla visible. Conviene auditar la trazabilidad competitiva de punta a punta.'
      };
    }

    if (summary.playedMatchCount > 0 && summary.activeRosterCount === 0) {
      return {
        health: 'attention',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction:
          'Ya hay partidos jugados, pero no hay rosters activos asociados. Conviene revisar la consistencia operativa entre inscripciones, rosters y fixture.'
      };
    }

    if (summary.registrationCount === 0) {
      return {
        health: 'attention',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: 'Aun no tiene inscripciones. El siguiente paso operativo es vincular equipos al torneo.'
      };
    }

    if (summary.approvedRegistrationCount > 0 && summary.activeRosterCount === 0) {
      return {
        health: 'attention',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: 'Ya hay equipos aprobados, pero falta poblar rosters activos para habilitar la competencia.'
      };
    }

    if (summary.approvedRegistrationCount > 1 && summary.matchCount === 0) {
      return {
        health: 'warning',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: 'La base competitiva ya existe. Conviene programar partidos para activar resultados y standings.'
      };
    }

    if (summary.playedMatchCount > 0 && summary.standingsCount === 0) {
      return {
        health: 'attention',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: 'Ya hay resultados cargados, pero todavia no se refleja tabla de posiciones para este torneo.'
      };
    }

    if (summary.status === 'IN_PROGRESS' && summary.playedMatchCount === 0) {
      return {
        health: 'warning',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: 'El torneo esta en curso, pero aun no registra partidos jugados.'
      };
    }

    return {
      health: 'healthy',
      readinessScore,
      auditStatus,
      auditMessage,
      blockers,
      nextAction: 'Mantiene trazabilidad visible desde la inscripcion hasta la tabla de posiciones.'
    };
  }

  private resolveReportingSegment(input: {
    tournament: Tournament;
    approvedRegistrationCount: number;
    activeRosterCount: number;
    matchCount: number;
    standingsCount: number;
  }): DashboardReportingSegment {
    const { tournament, approvedRegistrationCount, activeRosterCount, matchCount, standingsCount } = input;
    const hasOperationalActivity = approvedRegistrationCount > 0 || activeRosterCount > 0 || matchCount > 0 || standingsCount > 0;

    if (!hasOperationalActivity && (tournament.status === 'DRAFT' || this.hasQaSignal(tournament))) {
      return 'sandbox';
    }

    if (!hasOperationalActivity) {
      return 'setup';
    }

    return 'operational';
  }

  private hasQaSignal(tournament: Tournament): boolean {
    const normalized = `${tournament.name} ${tournament.slug} ${tournament.description ?? ''}`.toLowerCase();
    return ['qa', 'draft', 'postman', 'test', 'demo', 'sandbox'].some((token) => normalized.includes(token));
  }

  private toAlert(summary: DashboardTournamentSummary): DashboardAlert {
    return {
      title: summary.tournamentName,
      detail: summary.nextAction,
      health: summary.health,
      tournamentId: summary.tournamentId,
      tournamentName: summary.tournamentName,
      sportName: summary.sportName
    };
  }

  private healthPriority(health: DashboardHealth): number {
    const priorities: Record<DashboardHealth, number> = {
      healthy: 0,
      warning: 1,
      attention: 2
    };

    return priorities[health];
  }
}
