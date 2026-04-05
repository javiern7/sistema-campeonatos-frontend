import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { MatchGame } from '../matches/match.models';
import { MatchesService } from '../matches/matches.service';
import { PlayersService } from '../players/players.service';
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
import {
  Tournament,
  TournamentIntegrityAlertCode,
  TournamentOperationalCategory,
  TournamentOperationalSummary
} from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import {
  DashboardAlert,
  DashboardAlertType,
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
  private readonly matchesService = inject(MatchesService);
  private readonly standingsService = inject(StandingsService);

  getSummary(): Observable<DashboardSummary> {
    return forkJoin({
      sports: this.sportsService.list(false),
      teams: this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })),
      players: this.playersService.list({ page: 0, size: 1 }),
      tournaments: this.catalogLoader.loadAll((page, size) => this.tournamentsService.list({ page, size })),
      operationalSummaries: this.catalogLoader.loadAll((page, size) =>
        this.tournamentsService.listOperationalSummaries({ page, size })
      ),
      stages: this.catalogLoader.loadAll((page, size) => this.tournamentStagesService.list({ page, size })),
      groups: this.catalogLoader.loadAll((page, size) => this.stageGroupsService.list({ page, size })),
      registrations: this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ page, size })),
      matches: this.catalogLoader.loadAll((page, size) => this.matchesService.list({ page, size })),
      standings: this.catalogLoader.loadAll((page, size) => this.standingsService.list({ page, size }))
    }).pipe(map((data) => this.buildSummary(data)));
  }

  buildTournamentSummary(input: {
    tournament: Tournament;
    sportById: Map<number, Sport>;
    teamById: Map<number, Team>;
    registrationById: Map<number, TournamentTeam>;
    operationalSummary?: TournamentOperationalSummary | null;
    stages: TournamentStage[];
    groups: StageGroup[];
    registrations: TournamentTeam[];
    matches: MatchGame[];
    standings: Standing[];
  }): DashboardTournamentSummary {
    const { tournament, sportById, teamById, registrationById, operationalSummary, stages, groups, registrations, matches, standings } =
      input;
    const tournamentStages = stages.filter((item) => item.tournamentId === tournament.id);
    const stageIds = new Set(tournamentStages.map((item) => item.id));
    const tournamentGroups = groups.filter((item) => stageIds.has(item.stageId));
    const tournamentRegistrations = registrations.filter((item) => item.tournamentId === tournament.id);
    const approvedTournamentRegistrations = tournamentRegistrations.filter((item) => item.registrationStatus === 'APPROVED');
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

    const approvedRegistrationCount = operationalSummary?.approvedTeams ?? approvedTournamentRegistrations.length;
    const registrationsWithActiveRosterCount =
      operationalSummary?.approvedTeamsWithActiveRosterSupport ?? 0;
    const rosterGapCount =
      operationalSummary?.approvedTeamsMissingActiveRosterSupport ??
      Math.max(approvedRegistrationCount - registrationsWithActiveRosterCount, 0);
    const standingsCount = operationalSummary?.generatedStandings ?? tournamentStandings.length;
    const playedMatchCount =
      operationalSummary?.closedMatches ?? tournamentMatches.filter((item) => item.status === 'PLAYED').length;
    const standingsCoverageCount = Math.min(
      standingsCount > 0 ? standingsCount : standingTournamentTeamIds.size,
      Math.max(approvedRegistrationCount, 0)
    );
    const operationalCategory = operationalSummary?.operationalCategory ?? tournament.operationalCategory ?? 'PRODUCTION';
    const executiveReportingEligible =
      operationalSummary?.executiveReportingEligible ?? tournament.executiveReportingEligible ?? operationalCategory === 'PRODUCTION';
    const integrityHealthy = operationalSummary?.integrityHealthy ?? rosterGapCount === 0;
    const integrityAlertCodes = operationalSummary?.integrityAlerts ?? [];
    const reportingSegment = this.resolveReportingSegment({
      tournament,
      operationalCategory,
      executiveReportingEligible,
      approvedRegistrationCount,
      playedMatchCount,
      standingsCount
    });

    const summaryBase: Omit<
      DashboardTournamentSummary,
      'health' | 'readinessScore' | 'auditStatus' | 'auditMessage' | 'blockers' | 'nextAction'
    > = {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      sportName: sportById.get(tournament.sportId)?.name ?? `Deporte ${tournament.sportId}`,
      status: tournament.status,
      operationalCategory,
      executiveReportingEligible,
      integrityHealthy,
      integrityAlertCodes,
      reportingSegment,
      qaSignal: operationalCategory !== 'PRODUCTION' || this.hasQaSignal(tournament),
      stageCount: tournamentStages.length,
      groupCount: tournamentGroups.length,
      registrationCount: tournamentRegistrations.length,
      approvedRegistrationCount,
      registrationsWithActiveRosterCount,
      rosterGapCount,
      activeRosterCount: registrationsWithActiveRosterCount,
      matchCount: tournamentMatches.length,
      playedMatchCount,
      scheduledMatchCount: tournamentMatches.filter((item) => item.status === 'SCHEDULED').length,
      incidentMatchCount: tournamentMatches.filter((item) => item.status === 'FORFEIT' || item.status === 'CANCELLED').length,
      standingsCount,
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

  private buildSummary(data: {
    sports: Sport[];
    teams: Team[];
    players: { totalElements: number };
    tournaments: Tournament[];
    operationalSummaries: TournamentOperationalSummary[];
    stages: TournamentStage[];
    groups: StageGroup[];
    registrations: TournamentTeam[];
    matches: MatchGame[];
    standings: Standing[];
  }): DashboardSummary {
    const { sports, teams, players, tournaments, operationalSummaries, stages, groups, registrations, matches, standings } = data;
    const sportById = new Map(sports.map((sport) => [sport.id, sport] as const));
    const teamById = new Map(teams.map((team) => [team.id, team] as const));
    const registrationById = new Map(registrations.map((registration) => [registration.id, registration] as const));
    const operationalSummaryByTournamentId = new Map(
      operationalSummaries.map((summary) => [summary.tournamentId, summary] as const)
    );

    const tournamentSummaries = tournaments
      .map((tournament) =>
        this.buildTournamentSummary({
          tournament,
          sportById,
          teamById,
          registrationById,
          operationalSummary: operationalSummaryByTournamentId.get(tournament.id) ?? null,
          stages,
          groups,
          registrations,
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
      approvedRegistrationCount: tournamentSummaries.reduce((total, item) => total + item.approvedRegistrationCount, 0),
      matchCount: matches.length,
      playedMatchCount: tournamentSummaries.reduce((total, item) => total + item.playedMatchCount, 0),
      scheduledMatchCount: matches.filter((item) => item.status === 'SCHEDULED').length,
      activeRosterCount: tournamentSummaries.reduce((total, item) => total + item.registrationsWithActiveRosterCount, 0),
      standingsCount: tournamentSummaries.reduce((total, item) => total + item.standingsCount, 0),
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
      activeRosterCount: summaries.reduce((total, item) => total + item.registrationsWithActiveRosterCount, 0),
      matchCount: summaries.reduce((total, item) => total + item.matchCount, 0),
      playedMatchCount: summaries.reduce((total, item) => total + item.playedMatchCount, 0),
      standingsCount: summaries.reduce((total, item) => total + item.standingsCount, 0),
      alertCount: attentionCount + warningCount,
      health: attentionCount > 0 ? 'attention' : warningCount > 0 ? 'warning' : 'healthy',
      healthMessage:
        summaries.length === 0
          ? 'Aun no tiene torneos operativos en frontend.'
          : attentionCount > 0
            ? 'Tiene torneos con alertas de integridad o continuidad que requieren accion inmediata.'
            : warningCount > 0
              ? 'Ya tiene base competitiva, pero aun faltan cierres para una lectura ejecutiva estable.'
              : 'Muestra continuidad visible respaldada por el resumen operativo del backend.'
    };
  }

  private evaluateTournament(
    summary: Omit<
      DashboardTournamentSummary,
      'health' | 'readinessScore' | 'auditStatus' | 'auditMessage' | 'blockers' | 'nextAction'
    >
  ): {
    health: DashboardHealth;
    readinessScore: number;
    auditStatus: DashboardAuditStatus;
    auditMessage: string;
    blockers: string[];
    nextAction: string;
  } {
    const blockers = summary.integrityAlertCodes.map((code) => this.integrityAlertLabel(code, summary));
    let readinessScore = 0;
    const hasOperationalActivity =
      summary.approvedRegistrationCount > 0 || summary.playedMatchCount > 0 || summary.standingsCount > 0;

    if (summary.approvedRegistrationCount > 0) {
      readinessScore += 25;
    }
    if (summary.registrationsWithActiveRosterCount === summary.approvedRegistrationCount && summary.approvedRegistrationCount > 0) {
      readinessScore += 25;
    } else if (summary.registrationsWithActiveRosterCount > 0) {
      readinessScore += 10;
    }
    if (summary.playedMatchCount > 0) {
      readinessScore += 25;
    }
    if (summary.standingsCount > 0) {
      readinessScore += 25;
    }

    if (summary.registrationCount === 0) {
      blockers.push('Sin inscripciones');
    }
    if (summary.approvedRegistrationCount > 1 && summary.matchCount === 0) {
      blockers.push('Sin fixture cargado');
    }
    if (summary.reportingSegment === 'sandbox') {
      blockers.push('Torneo fuera del reporting ejecutivo principal');
    }

    const auditStatus: DashboardAuditStatus =
      summary.reportingSegment === 'sandbox'
        ? 'partial'
        : !summary.integrityHealthy
          ? 'blocked'
          : !hasOperationalActivity || blockers.length > 0
            ? 'partial'
            : 'ready';

    const auditMessage =
      auditStatus === 'ready'
        ? 'El backend confirma una lectura operativa consistente para este torneo.'
        : auditStatus === 'blocked'
          ? 'El backend reporta alertas de integridad. Conviene corregir la base antes de escalar la operacion.'
          : summary.reportingSegment === 'sandbox'
            ? 'Este torneo queda fuera del foco ejecutivo principal por su categoria operativa.'
            : 'El torneo aun esta en adopcion progresiva y necesita uno o mas cierres para consolidar su lectura operativa.';

    if (summary.reportingSegment === 'sandbox') {
      return {
        health: 'warning',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction:
          'Conviene mantener este torneo fuera del radar ejecutivo principal o recategorizarlo si ya paso a operacion real.'
      };
    }

    if (!summary.integrityHealthy) {
      return {
        health: 'attention',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: this.nextActionFromIntegrityAlert(this.highestPriorityIntegrityAlert(summary.integrityAlertCodes), summary)
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

    if (summary.approvedRegistrationCount > 0 && summary.registrationsWithActiveRosterCount === 0) {
      return {
        health: 'attention',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: 'Ya hay equipos aprobados, pero falta soporte de roster activo para habilitar una lectura operativa confiable.'
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

    if (summary.status === 'IN_PROGRESS' && summary.playedMatchCount === 0) {
      return {
        health: 'warning',
        readinessScore,
        auditStatus,
        auditMessage,
        blockers,
        nextAction: 'El torneo esta en curso, pero aun no registra partidos cerrados.'
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
    operationalCategory: TournamentOperationalCategory;
    executiveReportingEligible: boolean;
    approvedRegistrationCount: number;
    playedMatchCount: number;
    standingsCount: number;
  }): DashboardReportingSegment {
    const { tournament, operationalCategory, executiveReportingEligible, approvedRegistrationCount, playedMatchCount, standingsCount } =
      input;
    const hasOperationalActivity = approvedRegistrationCount > 0 || playedMatchCount > 0 || standingsCount > 0;

    if (operationalCategory !== 'PRODUCTION' || !executiveReportingEligible) {
      return 'sandbox';
    }

    if (!hasOperationalActivity && tournament.status === 'DRAFT') {
      return 'setup';
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

  private integrityAlertLabel(
    code: TournamentIntegrityAlertCode,
    summary: Pick<DashboardTournamentSummary, 'rosterGapCount'>
  ): string {
    const labels: Record<TournamentIntegrityAlertCode, string> = {
      APPROVED_TEAMS_MISSING_ACTIVE_ROSTER_SUPPORT: `${summary.rosterGapCount} inscripciones aprobadas sin soporte de roster activo`,
      CLOSED_MATCHES_WITHOUT_FULL_ACTIVE_ROSTER_SUPPORT: 'Partidos cerrados sin soporte completo de roster activo',
      CLOSED_MATCHES_WITHOUT_STANDINGS: 'Resultados cerrados sin standings visibles',
      STANDINGS_WITHOUT_CLOSED_MATCHES: 'Standings visibles sin partidos cerrados',
      CLOSED_MATCHES_WITHOUT_APPROVED_TEAMS: 'Partidos cerrados sin equipos aprobados'
    };

    return labels[code];
  }

  private highestPriorityIntegrityAlert(
    codes: TournamentIntegrityAlertCode[]
  ): TournamentIntegrityAlertCode | null {
    const priorities: TournamentIntegrityAlertCode[] = [
      'CLOSED_MATCHES_WITHOUT_APPROVED_TEAMS',
      'CLOSED_MATCHES_WITHOUT_FULL_ACTIVE_ROSTER_SUPPORT',
      'CLOSED_MATCHES_WITHOUT_STANDINGS',
      'APPROVED_TEAMS_MISSING_ACTIVE_ROSTER_SUPPORT',
      'STANDINGS_WITHOUT_CLOSED_MATCHES'
    ];

    return priorities.find((code) => codes.includes(code)) ?? null;
  }

  private nextActionFromIntegrityAlert(
    code: TournamentIntegrityAlertCode | null,
    summary: Pick<
      DashboardTournamentSummary,
      'rosterGapCount'
    >
  ): string {
    switch (code) {
      case 'APPROVED_TEAMS_MISSING_ACTIVE_ROSTER_SUPPORT':
        return `${summary.rosterGapCount} inscripciones aprobadas aun no tienen soporte de roster activo. Conviene corregir esa base antes de confiar en el fixture.`;
      case 'CLOSED_MATCHES_WITHOUT_FULL_ACTIVE_ROSTER_SUPPORT':
        return 'Ya existen partidos cerrados sin soporte completo de roster activo. Conviene auditar la trazabilidad competitiva de punta a punta.';
      case 'CLOSED_MATCHES_WITHOUT_STANDINGS':
        return 'Ya existen resultados cerrados, pero la tabla aun no refleja esa operacion. Conviene revisar standings para este torneo.';
      case 'STANDINGS_WITHOUT_CLOSED_MATCHES':
        return 'La tabla visible no tiene respaldo suficiente en partidos cerrados. Conviene revisar la consistencia operativa del torneo.';
      case 'CLOSED_MATCHES_WITHOUT_APPROVED_TEAMS':
        return 'Se detecto competencia cerrada sin base aprobada suficiente. Conviene revisar inscripciones y resultados antes de continuar.';
      default:
        return 'Conviene revisar el detalle del torneo y cerrar las brechas operativas visibles antes de seguir escalando.';
    }
  }

  private toAlert(summary: DashboardTournamentSummary): DashboardAlert {
    const alertType = this.resolveAlertType(summary);
    const action = this.resolveAlertAction(summary, alertType);

    return {
      title: summary.tournamentName,
      detail: summary.nextAction,
      health: summary.health,
      type: alertType,
      tournamentId: summary.tournamentId,
      tournamentName: summary.tournamentName,
      sportName: summary.sportName,
      actionLabel: action.label,
      actionPath: action.path,
      actionQueryParams: action.queryParams
    };
  }

  private resolveAlertType(summary: DashboardTournamentSummary): DashboardAlertType {
    if (summary.reportingSegment === 'sandbox') {
      return 'sandbox';
    }

    if (summary.registrationCount === 0) {
      return 'registrations';
    }

    if (
      summary.integrityAlertCodes.includes('APPROVED_TEAMS_MISSING_ACTIVE_ROSTER_SUPPORT') ||
      (summary.approvedRegistrationCount > 0 && summary.rosterGapCount > 0)
    ) {
      return 'rosters';
    }

    if (summary.approvedRegistrationCount > 1 && summary.matchCount === 0) {
      return 'matches';
    }

    if (summary.integrityAlertCodes.includes('CLOSED_MATCHES_WITHOUT_STANDINGS')) {
      return 'standings';
    }

    return 'state';
  }

  private resolveAlertAction(
    summary: DashboardTournamentSummary,
    alertType: DashboardAlertType
  ): { label: string; path: string; queryParams: Record<string, string | number> } {
    switch (alertType) {
      case 'registrations':
        return {
          label: 'Abrir inscripciones',
          path: '/tournament-teams',
          queryParams: { tournamentId: summary.tournamentId }
        };
      case 'rosters':
        return {
          label: 'Abrir rosters',
          path: '/rosters',
          queryParams: { rosterStatus: 'ACTIVE' }
        };
      case 'matches':
        return {
          label: 'Abrir partidos',
          path: '/matches',
          queryParams: { tournamentId: summary.tournamentId }
        };
      case 'standings':
        return {
          label: 'Abrir standings',
          path: '/standings',
          queryParams: { tournamentId: summary.tournamentId }
        };
      default:
        return {
          label: 'Abrir detalle',
          path: `/tournaments/${summary.tournamentId}`,
          queryParams: {}
        };
    }
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
