import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { MatchGame } from '../matches/match.models';
import { MatchesService } from '../matches/matches.service';
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
import { Tournament } from './tournament.models';
import { TournamentsService } from './tournaments.service';
import { DashboardTournamentSummary } from '../dashboard/dashboard.models';
import { DashboardService } from '../dashboard/dashboard.service';

type DetailMetric = {
  label: string;
  value: number | string;
  meta: string;
  accent?: boolean;
};

@Component({
  selector: 'app-tournament-detail-page',
  standalone: true,
  imports: [RouterLink, MatButtonModule, PageHeaderComponent, LoadingStateComponent],
  template: `
    <section class="app-page">
      @if (loading()) {
        <app-page-header title="Detalle de torneo" subtitle="Cargando contexto operativo consolidado..." />
        <app-loading-state />
      } @else if (!tournament()) {
        <app-page-header title="Detalle de torneo" subtitle="No se encontro el torneo solicitado." />
        <section class="card page-card app-page">
          <div class="empty-state">
            <strong>El torneo no esta disponible.</strong>
            <p class="muted">Verifica el identificador o vuelve al listado principal de torneos.</p>
            <a mat-flat-button color="primary" routerLink="/tournaments">Volver a torneos</a>
          </div>
        </section>
      } @else {
        <app-page-header [title]="tournament()!.name" [subtitle]="headerSubtitle()">
          <div class="header-actions">
            <a mat-stroked-button routerLink="/tournaments">Volver</a>
            <a mat-stroked-button [routerLink]="['/tournaments', tournament()!.id, 'edit']">Editar torneo</a>
            <a
              mat-flat-button
              color="primary"
              routerLink="/tournament-teams/new"
              [queryParams]="{ tournamentId: tournament()!.id }"
            >
              Nueva inscripcion
            </a>
          </div>
        </app-page-header>

        <section class="context-hero card">
          <div class="hero-main">
            <div class="stack-sm">
              <div class="hero-row">
                <span class="hero-kicker">{{ sportName() }}</span>
                <span class="status-pill" [class]="statusClass(tournament()!.status)">{{ statusLabel(tournament()!.status) }}</span>
                @if (isSandboxTournament()) {
                  <span class="segment-pill sandbox">QA / borrador</span>
                } @else {
                  <span class="segment-pill operational">Flujo principal</span>
                }
              </div>
              <h2>{{ tournament()!.seasonName || 'Temporada sin etiqueta' }}</h2>
              <p class="muted">{{ tournament()!.description || 'Sin descripcion operativa cargada.' }}</p>
            </div>

            <div class="hero-actions">
              <a
                mat-stroked-button
                routerLink="/tournament-teams"
                [queryParams]="{ tournamentId: tournament()!.id }"
              >
                Ver inscripciones
              </a>
              <a
                mat-stroked-button
                routerLink="/matches"
                [queryParams]="{ tournamentId: tournament()!.id }"
              >
                Ver partidos
              </a>
              <a
                mat-stroked-button
                routerLink="/standings"
                [queryParams]="{ tournamentId: tournament()!.id }"
              >
                Ver standings
              </a>
            </div>
          </div>

          <div class="hero-side">
            <div class="hero-note">
              <strong>Lectura operativa</strong>
              <p>{{ summary()?.auditMessage || 'Sin evaluacion ejecutiva disponible para este torneo.' }}</p>
            </div>
            <div class="hero-note">
              <strong>Siguiente paso recomendado</strong>
              <p>{{ summary()?.nextAction || 'Completar el flujo torneo -> inscripcion -> roster -> partido -> standings.' }}</p>
            </div>
          </div>
        </section>

        <div class="summary-grid">
          @for (metric of metrics(); track metric.label) {
            <article class="summary-card card" [class.accent]="metric.accent">
              <span class="summary-label">{{ metric.label }}</span>
              <span class="summary-value">{{ metric.value }}</span>
              <span class="summary-meta">{{ metric.meta }}</span>
            </article>
          }
        </div>

        @if (summary()?.blockers?.length) {
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Alertas activas</h2>
                <p class="muted">Brechas que hoy frenan continuidad o reducen confianza operativa.</p>
              </div>
            </div>

            <div class="chip-row">
              @for (blocker of summary()!.blockers; track blocker) {
                <span class="blocker-chip">{{ blocker }}</span>
              }
            </div>
          </section>
        }

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Inscripciones aprobadas y roster</h2>
              <p class="muted">Base operativa del torneo para sostener fixture y tabla.</p>
            </div>
            <a
              mat-button
              routerLink="/tournament-teams"
              [queryParams]="{ tournamentId: tournament()!.id, registrationStatus: 'APPROVED' }"
            >
              Abrir inscripciones aprobadas
            </a>
          </div>

          @if (registrationRows().length === 0) {
            <div class="empty-state">
              <strong>No hay inscripciones para este torneo.</strong>
              <p class="muted">El siguiente paso operativo es vincular equipos y aprobar las inscripciones necesarias.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table class="detail-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Inscripcion</th>
                    <th>Roster activo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of registrationRows(); track row.registration.id) {
                    <tr>
                      <td>{{ teamName(row.registration.teamId) }}</td>
                      <td>#{{ row.registration.id }}</td>
                      <td>{{ row.activeRosterCount }} jugador(es)</td>
                      <td>
                        <span [class]="registrationStatusClass(row.registration.registrationStatus)">
                          {{ registrationStatusLabel(row.registration.registrationStatus) }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="detail-grid">
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Partidos recientes</h2>
                <p class="muted">Ultimos movimientos del fixture en este torneo.</p>
              </div>
              <a mat-button routerLink="/matches" [queryParams]="{ tournamentId: tournament()!.id }">Abrir partidos</a>
            </div>

            @if (recentMatches().length === 0) {
              <div class="empty-state">
                <strong>Aun no hay partidos visibles.</strong>
                <p class="muted">Cuando existan partidos, esta vista ayudara a seguir continuidad y novedades.</p>
              </div>
            } @else {
              <div class="list-stack">
                @for (match of recentMatches(); track match.id) {
                  <article class="list-card">
                    <div class="list-row">
                      <strong>{{ tournamentTeamLabel(match.homeTournamentTeamId) }} vs {{ tournamentTeamLabel(match.awayTournamentTeamId) }}</strong>
                      <span [class]="matchStatusClass(match.status)">{{ matchStatusLabel(match.status) }}</span>
                    </div>
                    <div class="list-meta">
                      <span>{{ matchContextLabel(match) }}</span>
                      <span>{{ matchScoreLabel(match) }}</span>
                    </div>
                  </article>
                }
              </div>
            }
          </section>

          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Top standings</h2>
                <p class="muted">Lectura rapida del liderazgo actual del torneo.</p>
              </div>
              <a mat-button routerLink="/standings" [queryParams]="{ tournamentId: tournament()!.id }">Abrir standings</a>
            </div>

            @if (topStandings().length === 0) {
              <div class="empty-state">
                <strong>No hay standings cargados.</strong>
                <p class="muted">La tabla aparecera aqui cuando existan resultados cerrados y standings calculados.</p>
              </div>
            } @else {
              <div class="list-stack">
                @for (standing of topStandings(); track standing.id) {
                  <article class="list-card">
                    <div class="list-row">
                      <strong>#{{ standing.rankPosition ?? '-' }} {{ tournamentTeamLabel(standing.tournamentTeamId) }}</strong>
                      <span>{{ standing.points }} pts</span>
                    </div>
                    <div class="list-meta">
                      <span>{{ standing.played }} PJ / {{ standing.wins }} G / {{ standing.draws }} E / {{ standing.losses }} P</span>
                      <span>Dif. {{ standing.scoreDiff }}</span>
                    </div>
                  </article>
                }
              </div>
            }
          </section>
        </section>
      }
    </section>
  `,
  styles: [
    `
      .header-actions,
      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .context-hero {
        display: grid;
        gap: 1rem;
        padding: 1.25rem;
        grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
      }

      .hero-main,
      .hero-side {
        display: grid;
        gap: 1rem;
      }

      .hero-row,
      .list-row,
      .section-heading {
        display: flex;
        gap: 0.75rem;
        align-items: start;
        justify-content: space-between;
      }

      .hero-kicker {
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--primary);
      }

      .segment-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .segment-pill.operational {
        background: #dcfce7;
        color: #166534;
      }

      .segment-pill.sandbox {
        background: #fef3c7;
        color: #92400e;
      }

      .hero-main h2,
      .section-heading h2 {
        margin: 0;
      }

      .hero-main p,
      .hero-note p,
      .section-heading p {
        margin: 0.35rem 0 0;
      }

      .hero-note {
        padding: 1rem;
        border-radius: 16px;
        background: var(--surface-alt);
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .blocker-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        background: #fff7ed;
        color: #9a3412;
        font-size: 0.8rem;
        font-weight: 700;
      }

      .detail-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }

      .detail-table {
        width: 100%;
        border-collapse: collapse;
      }

      .detail-table th,
      .detail-table td {
        padding: 0.85rem 0.75rem;
        text-align: left;
        border-bottom: 1px solid var(--border);
      }

      .detail-table th {
        color: var(--text-soft);
        font-size: 0.85rem;
        font-weight: 700;
      }

      .list-stack {
        display: grid;
        gap: 0.75rem;
      }

      .list-card {
        display: grid;
        gap: 0.45rem;
        padding: 0.95rem 1rem;
        border-radius: 16px;
        background: var(--surface-alt);
      }

      .list-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        color: var(--text-soft);
        font-size: 0.88rem;
      }

      @media (max-width: 900px) {
        .context-hero {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly sportsService = inject(SportsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly rostersService = inject(RostersService);
  private readonly matchesService = inject(MatchesService);
  private readonly standingsService = inject(StandingsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly dashboardService = inject(DashboardService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly tournament = signal<Tournament | null>(null);
  protected readonly summary = signal<DashboardTournamentSummary | null>(null);
  protected readonly sports = signal<Sport[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly registrations = signal<TournamentTeam[]>([]);
  protected readonly rosters = signal<RosterEntry[]>([]);
  protected readonly matches = signal<MatchGame[]>([]);
  protected readonly standings = signal<Standing[]>([]);
  protected readonly stages = signal<TournamentStage[]>([]);
  protected readonly groups = signal<StageGroup[]>([]);
  protected readonly sportName = computed(() => {
    const tournament = this.tournament();
    if (!tournament) {
      return 'Torneo';
    }

    return this.sports().find((item) => item.id === tournament.sportId)?.name ?? `Deporte ${tournament.sportId}`;
  });
  protected readonly headerSubtitle = computed(() => {
    const tournament = this.tournament();
    if (!tournament) {
      return '';
    }

    const parts = [this.sportName(), `Formato ${this.formatLabel(tournament.format)}`, this.statusLabel(tournament.status)];
    return parts.join(' / ');
  });
  protected readonly metrics = computed<DetailMetric[]>(() => {
    const summary = this.summary();
    const tournament = this.tournament();

    return [
      {
        label: 'Madurez operativa',
        value: `${summary?.readinessScore ?? 0}%`,
        meta: summary?.auditStatus === 'ready' ? 'Flujo visible de punta a punta' : 'Aun requiere seguimiento',
        accent: true
      },
      {
        label: 'Inscripciones',
        value: summary?.registrationCount ?? 0,
        meta: `${summary?.approvedRegistrationCount ?? 0} aprobadas`
      },
      {
        label: 'Rosters activos',
        value: summary?.activeRosterCount ?? 0,
        meta: `${summary?.registrationsWithActiveRosterCount ?? 0} inscripciones con soporte`
      },
      {
        label: 'Partidos',
        value: summary?.matchCount ?? 0,
        meta: `${summary?.playedMatchCount ?? 0} jugados`
      },
      {
        label: 'Standings',
        value: summary?.standingsCount ?? 0,
        meta: summary?.leaderName ? `Lider: ${summary.leaderName}` : 'Sin lider visible'
      },
      {
        label: 'Ventana',
        value: this.dateRangeLabel(tournament),
        meta: 'Fechas operativas del torneo'
      }
    ];
  });
  protected readonly registrationRows = computed(() => {
    const registrations = [...this.registrations()].sort((left, right) => {
      if (left.registrationStatus !== right.registrationStatus) {
        return this.registrationPriority(left.registrationStatus) - this.registrationPriority(right.registrationStatus);
      }

      const leftTeam = this.teamName(left.teamId);
      const rightTeam = this.teamName(right.teamId);
      return leftTeam.localeCompare(rightTeam, 'es');
    });
    const activeRosterCounts = this.activeRosterCountByRegistration();

    return registrations.map((registration) => ({
      registration,
      activeRosterCount: activeRosterCounts.get(registration.id) ?? 0
    }));
  });
  protected readonly recentMatches = computed(() =>
    [...this.matches()]
      .sort((left, right) => {
        const leftTime = this.sortableDateValue(left.scheduledAt ?? left.updatedAt);
        const rightTime = this.sortableDateValue(right.scheduledAt ?? right.updatedAt);
        return rightTime - leftTime;
      })
      .slice(0, 5)
  );
  protected readonly topStandings = computed(() =>
    [...this.standings()]
      .sort((left, right) => {
        const leftRank = left.rankPosition ?? Number.MAX_SAFE_INTEGER;
        const rightRank = right.rankPosition ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return right.points - left.points;
      })
      .slice(0, 5)
  );
  protected readonly isSandboxTournament = computed(() => this.summary()?.reportingSegment === 'sandbox');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = Number(params.get('id'));

      if (!id) {
        this.loading.set(false);
        this.tournament.set(null);
        return;
      }

      this.load(id);
    });
  }

  private load(tournamentId: number): void {
    this.loading.set(true);

    forkJoin({
      tournament: this.tournamentsService.getById(tournamentId),
      sports: this.sportsService.list(false),
      teams: this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })),
      registrations: this.catalogLoader.loadAll((page, size) =>
        this.tournamentTeamsService.list({ tournamentId, page, size })
      ),
      rosters: this.catalogLoader.loadAll((page, size) => this.rostersService.list({ page, size })),
      matches: this.catalogLoader.loadAll((page, size) => this.matchesService.list({ tournamentId, page, size })),
      standings: this.catalogLoader.loadAll((page, size) => this.standingsService.list({ tournamentId, page, size })),
      stages: this.catalogLoader.loadAll((page, size) => this.stagesService.list({ page, size })),
      groups: this.catalogLoader.loadAll((page, size) => this.groupsService.list({ page, size })),
      dashboard: this.dashboardService.getSummary()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const registrationIds = new Set(result.registrations.map((item) => item.id));

          this.tournament.set(result.tournament);
          this.sports.set(result.sports);
          this.teams.set(result.teams);
          this.registrations.set(result.registrations);
          this.rosters.set(result.rosters.filter((item) => registrationIds.has(item.tournamentTeamId)));
          this.matches.set(result.matches);
          this.standings.set(result.standings);
          this.stages.set(result.stages.filter((item) => item.tournamentId === tournamentId));
          const stageIds = new Set(result.stages.filter((item) => item.tournamentId === tournamentId).map((item) => item.id));
          this.groups.set(result.groups.filter((item) => stageIds.has(item.stageId)));
          this.summary.set(
            result.dashboard.tournamentSummaries.find((item) => item.tournamentId === tournamentId) ?? null
          );
        },
        error: (error: unknown) => {
          this.tournament.set(null);
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }

  private activeRosterCountByRegistration(): Map<number, number> {
    return this.rosters().reduce((counts, roster) => {
      if (roster.rosterStatus !== 'ACTIVE') {
        return counts;
      }

      counts.set(roster.tournamentTeamId, (counts.get(roster.tournamentTeamId) ?? 0) + 1);
      return counts;
    }, new Map<number, number>());
  }

  protected teamName(teamId: number): string {
    return this.teams().find((item) => item.id === teamId)?.name ?? `Equipo ${teamId}`;
  }

  protected tournamentTeamLabel(tournamentTeamId: number): string {
    const registration = this.registrations().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `#${tournamentTeamId}`;
    }

    return `${this.teamName(registration.teamId)} (#${registration.id})`;
  }

  protected matchContextLabel(match: MatchGame): string {
    const parts = [this.stageName(match.stageId), this.groupName(match.groupId), this.programmingLabel(match)].filter((item) =>
      Boolean(item)
    );
    return parts.join(' / ') || 'Sin contexto adicional';
  }

  protected matchScoreLabel(match: MatchGame): string {
    if (match.homeScore === null || match.awayScore === null) {
      return this.formatDate(match.scheduledAt) || 'Marcador pendiente';
    }

    return `${match.homeScore} - ${match.awayScore}`;
  }

  protected stageName(stageId: number | null): string {
    if (!stageId) {
      return '';
    }

    return this.stages().find((item) => item.id === stageId)?.name ?? `Etapa ${stageId}`;
  }

  protected groupName(groupId: number | null): string {
    if (!groupId) {
      return '';
    }

    return this.groups().find((item) => item.id === groupId)?.name ?? `Grupo ${groupId}`;
  }

  protected programmingLabel(match: MatchGame): string {
    const labels = [];
    if (match.roundNumber !== null) {
      labels.push(`Ronda ${match.roundNumber}`);
    }
    if (match.matchdayNumber !== null) {
      labels.push(`Fecha ${match.matchdayNumber}`);
    }

    return labels.join(' / ');
  }

  protected formatDate(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    if (!parsed) {
      return '';
    }

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(parsed);
  }

  protected dateRangeLabel(tournament: Tournament | null): string {
    if (!tournament) {
      return '-';
    }

    const start = tournament.startDate ?? 'Sin inicio';
    const end = tournament.endDate ?? 'sin cierre';
    return `${start} a ${end}`;
  }

  protected formatLabel(format: Tournament['format']): string {
    const labels: Record<Tournament['format'], string> = {
      LEAGUE: 'Liga',
      GROUPS_THEN_KNOCKOUT: 'Grupos + eliminacion',
      KNOCKOUT: 'Eliminacion'
    };

    return labels[format];
  }

  protected statusLabel(status: Tournament['status']): string {
    const labels: Record<Tournament['status'], string> = {
      DRAFT: 'Borrador',
      OPEN: 'Abierto',
      IN_PROGRESS: 'En curso',
      FINISHED: 'Finalizado',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  protected statusClass(status: Tournament['status']): string {
    const statusMap: Record<Tournament['status'], string> = {
      DRAFT: 'scheduled',
      OPEN: 'scheduled',
      IN_PROGRESS: 'played',
      FINISHED: 'played',
      CANCELLED: 'cancelled'
    };

    return statusMap[status];
  }

  protected registrationStatusLabel(status: TournamentTeam['registrationStatus']): string {
    const labels: Record<TournamentTeam['registrationStatus'], string> = {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      WITHDRAWN: 'Retirada'
    };

    return labels[status];
  }

  protected registrationStatusClass(status: TournamentTeam['registrationStatus']): string {
    const statusMap: Record<TournamentTeam['registrationStatus'], string> = {
      PENDING: 'status-pill scheduled',
      APPROVED: 'status-pill played',
      REJECTED: 'status-pill cancelled',
      WITHDRAWN: 'status-pill forfeit'
    };

    return statusMap[status];
  }

  protected matchStatusLabel(status: MatchGame['status']): string {
    const labels: Record<MatchGame['status'], string> = {
      SCHEDULED: 'Programado',
      PLAYED: 'Jugado',
      FORFEIT: 'Forfeit',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  protected matchStatusClass(status: MatchGame['status']): string {
    return `status-pill ${status.toLowerCase()}`;
  }

  private registrationPriority(status: TournamentTeam['registrationStatus']): number {
    const priorities: Record<TournamentTeam['registrationStatus'], number> = {
      APPROVED: 0,
      PENDING: 1,
      WITHDRAWN: 2,
      REJECTED: 3
    };

    return priorities[status];
  }

  private sortableDateValue(value: string | null): number {
    const parsed = parseBackendDateTime(value);
    return parsed ? parsed.getTime() : 0;
  }
}
