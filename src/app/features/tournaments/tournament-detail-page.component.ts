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

type QuickAction = {
  label: string;
  description: string;
  cta: string;
  path: string;
  queryParams: Record<string, string | number>;
};

type StateAssistant = {
  title: string;
  summary: string;
  readiness: string;
  caution: string;
};

type TournamentPulseCard = {
  label: string;
  headline: string;
  detail: string;
  accent?: boolean;
};

type RegistrationOverviewCard = {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
};

const qp = (params: Record<string, string | number>): Record<string, string | number> => params;

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
                [routerLink]="['/tournaments', tournament()!.id, 'competition-advanced']"
              >
                Competencia avanzada
              </a>
              <a
                mat-stroked-button
                [routerLink]="['/tournaments', tournament()!.id, 'statistics', 'basic']"
              >
                Estadisticas basicas
              </a>
              <a
                mat-stroked-button
                [routerLink]="['/tournaments', tournament()!.id, 'discipline']"
              >
                Disciplina
              </a>
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

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Pulso ejecutivo</h2>
              <p class="muted">Resumen corto para entender si el torneo esta listo, que tan clara es su lectura competitiva y donde mirar primero.</p>
            </div>
          </div>

          <div class="pulse-grid">
            @for (card of pulseCards(); track card.label) {
              <article class="pulse-card" [class.accent]="card.accent">
                <span class="assistant-label">{{ card.label }}</span>
                <strong>{{ card.headline }}</strong>
                <p class="muted">{{ card.detail }}</p>
              </article>
            }
          </div>
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Asistencia por estado</h2>
              <p class="muted">Lectura guiada de lo que significa el estado actual del torneo y que conviene hacer ahora.</p>
            </div>
          </div>

          <div class="state-assistant-grid">
            <article class="assistant-card">
              <span class="assistant-label">Momento actual</span>
              <strong>{{ stateAssistant().title }}</strong>
              <p class="muted">{{ stateAssistant().summary }}</p>
            </article>

            <article class="assistant-card">
              <span class="assistant-label">Para seguir</span>
              <strong>{{ stateAssistant().readiness }}</strong>
              <p class="muted">{{ summary()?.nextAction || 'Continuar consolidando el flujo competitivo.' }}</p>
            </article>

            <article class="assistant-card">
              <span class="assistant-label">Cuidado</span>
              <strong>Evitar salto desordenado</strong>
              <p class="muted">{{ stateAssistant().caution }}</p>
            </article>
          </div>
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Acciones rapidas</h2>
              <p class="muted">Siguiente bloque recomendado segun el estado y la madurez actual del torneo.</p>
            </div>
          </div>

          <div class="quick-actions-grid">
            @for (action of quickActions(); track action.label) {
              <article class="quick-action-card">
                <strong>{{ action.label }}</strong>
                <p class="muted">{{ action.description }}</p>
                <a mat-button [routerLink]="action.path" [queryParams]="action.queryParams">{{ action.cta }}</a>
              </article>
            }
          </div>
        </section>

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

          <div class="registration-overview-grid">
            @for (card of registrationOverviewCards(); track card.label) {
              <article class="registration-overview-card" [class.accent]="card.accent">
                <span class="assistant-label">{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
                <p class="muted">{{ card.detail }}</p>
              </article>
            }
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
                    <th>Accion</th>
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
                      <td>
                        <a
                          mat-button
                          [routerLink]="row.activeRosterCount > 0 ? '/rosters' : '/rosters/new'"
                          [queryParams]="{ tournamentTeamId: row.registration.id, rosterStatus: 'ACTIVE' }"
                        >
                          {{ row.activeRosterCount > 0 ? 'Ver roster' : 'Cargar roster' }}
                        </a>
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

      .pulse-grid,
      .quick-actions-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .state-assistant-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .registration-overview-grid,
      .quick-action-card {
        display: grid;
      }

      .registration-overview-grid {
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .quick-action-card {
        gap: 0.55rem;
        padding: 1rem;
        border-radius: 16px;
        background: var(--surface-alt);
      }

      .pulse-card {
        display: grid;
        gap: 0.45rem;
        padding: 1rem;
        border-radius: 16px;
        background: var(--surface-alt);
      }

      .pulse-card.accent {
        background: linear-gradient(135deg, rgba(10, 110, 90, 0.12), rgba(10, 110, 90, 0.04));
        border: 1px solid rgba(10, 110, 90, 0.16);
      }

      .registration-overview-card {
        display: grid;
        gap: 0.45rem;
        padding: 1rem;
        border-radius: 16px;
        background: var(--surface-alt);
      }

      .registration-overview-card.accent {
        background: linear-gradient(135deg, rgba(10, 110, 90, 0.12), rgba(10, 110, 90, 0.04));
        border: 1px solid rgba(10, 110, 90, 0.16);
      }

      .quick-action-card p {
        margin: 0;
      }

      .assistant-card {
        display: grid;
        gap: 0.45rem;
        padding: 1rem;
        border-radius: 16px;
        background: var(--surface-alt);
      }

      .assistant-card p {
        margin: 0;
      }

      .pulse-card p {
        margin: 0;
      }

      .assistant-label {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-soft);
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
        label: 'Soporte roster',
        value: summary?.registrationsWithActiveRosterCount ?? 0,
        meta: `${summary?.rosterGapCount ?? 0} brechas activas`
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
  protected readonly pulseCards = computed<TournamentPulseCard[]>(() => {
    const summary = this.summary();

    return [
      {
        label: 'Estado de auditoria',
        headline:
          summary?.auditStatus === 'ready'
            ? 'Listo para lectura ejecutiva'
            : summary?.auditStatus === 'blocked'
              ? 'Continuidad interrumpida'
              : 'Aun en consolidacion',
        detail: summary?.auditMessage ?? 'Sin evaluacion visible.',
        accent: summary?.auditStatus === 'ready'
      },
      {
        label: 'Cobertura de roster',
        headline: `${summary?.registrationsWithActiveRosterCount ?? 0}/${summary?.approvedRegistrationCount ?? 0} aprobadas cubiertas`,
        detail:
          (summary?.approvedRegistrationCount ?? 0) > 0
            ? `${summary?.rosterGapCount ?? 0} brechas pendientes en la base operativa`
            : 'Todavia no hay base aprobada para exigir roster activo'
      },
      {
        label: 'Ritmo competitivo',
        headline: `${summary?.playedMatchCount ?? 0}/${summary?.matchCount ?? 0} partidos jugados`,
        detail:
          (summary?.matchCount ?? 0) > 0
            ? `${summary?.scheduledMatchCount ?? 0} siguen programados y ${summary?.incidentMatchCount ?? 0} presentan incidencia`
            : 'Aun no hay fixture visible para este torneo'
      },
      {
        label: 'Claridad de standings',
        headline:
          (summary?.standingsCount ?? 0) > 0
            ? `${summary?.standingsCoverageCount ?? 0} equipos con tabla`
            : 'Sin tabla visible',
        detail: summary?.leaderName
          ? `Lider actual: ${summary.leaderName} con ${summary.leaderPoints ?? 0} pts`
          : 'Todavia no hay liderazgo competitivo consolidado'
      }
    ];
  });
  protected readonly registrationOverviewCards = computed<RegistrationOverviewCard[]>(() => {
    const summary = this.summary();
    const registrations = this.registrations();
    const approvedCount = summary?.approvedRegistrationCount ?? 0;
    const pendingCount = registrations.filter((item) => item.registrationStatus === 'PENDING').length;
    const coveredCount = summary?.registrationsWithActiveRosterCount ?? 0;
    const standingsCovered = summary?.standingsCoverageCount ?? 0;

    return [
      {
        label: 'Base aprobada',
        value: `${approvedCount}`,
        detail:
          approvedCount > 0
            ? `${pendingCount} pendientes y ${registrations.length - approvedCount - pendingCount} fuera del flujo principal`
            : 'Aun no hay inscripciones aprobadas para competir'
      },
      {
        label: 'Cobertura roster',
        value: `${coveredCount}/${approvedCount}`,
        detail:
          approvedCount > 0
            ? `${summary?.rosterGapCount ?? 0} brechas activas antes de confiar en el fixture`
            : 'Sin base aprobada aun'
      },
      {
        label: 'Cobertura standings',
        value: `${standingsCovered}/${approvedCount}`,
        detail:
          (summary?.playedMatchCount ?? 0) > 0
            ? `${summary?.standingsCount ?? 0} filas de tabla visibles tras resultados`
            : 'Todavia no hay actividad competitiva cerrada'
      },
      {
        label: 'Siguiente foco',
        value: summary?.auditStatus === 'ready' ? 'Consolidado' : 'Seguimiento',
        detail: summary?.nextAction ?? 'Completar la base operativa del torneo.',
        accent: summary?.auditStatus === 'ready'
      }
    ];
  });
  protected readonly stateAssistant = computed<StateAssistant>(() => {
    const tournament = this.tournament();
    const summary = this.summary();

    if (!tournament) {
      return {
        title: 'Sin contexto',
        summary: 'No hay torneo cargado para interpretar su estado.',
        readiness: 'Cargar un torneo',
        caution: 'Evitar operar sin contexto completo.'
      };
    }

    switch (tournament.status) {
      case 'DRAFT':
        return {
          title: 'Borrador de preparacion',
          summary: 'El torneo aun esta en configuracion. Conviene cerrar base competitiva y separar claramente cualquier QA.',
          readiness:
            (summary?.approvedRegistrationCount ?? 0) > 0
              ? 'Ya tiene base para abrir inscripciones al flujo operativo'
              : 'Todavia falta poblar inscripciones para salir del borrador',
          caution: 'No conviene mezclar carga de partidos o tabla mientras la base siga incompleta o en modo QA.'
        };
      case 'OPEN':
        return {
          title: 'Abierto para consolidar base',
          summary: 'El torneo ya puede recibir y aprobar inscripciones. El foco deberia estar en dejar roster y fixture listos.',
          readiness:
            (summary?.rosterGapCount ?? 0) === 0 && (summary?.approvedRegistrationCount ?? 0) > 1
              ? 'La base parece lista para empujar programacion de partidos'
              : 'Aun conviene cerrar inscripciones aprobadas y roster activo',
          caution: 'Iniciar competencia sin roster o sin participantes aprobados vuelve opaca la trazabilidad posterior.'
        };
      case 'IN_PROGRESS':
        return {
          title: 'Competencia en curso',
          summary: 'La prioridad es sostener continuidad entre resultados, incidencias y lectura de standings.',
          readiness:
            (summary?.playedMatchCount ?? 0) > 0
              ? 'Ya hay actividad real para auditar en standings y continuidad operativa'
              : 'El estado indica competencia activa, pero todavia falta evidencia visible de partidos jugados',
          caution: 'Resultados sin tabla o sin soporte de roster generan la mayor perdida de confianza operativa.'
        };
      case 'FINISHED':
        return {
          title: 'Cierre competitivo',
          summary: 'El torneo ya deberia leerse como ciclo cerrado, con standings completos y sin brechas visibles.',
          readiness:
            (summary?.standingsCount ?? 0) > 0
              ? 'La lectura ejecutiva ya puede enfocarse en validacion final y presentacion'
              : 'Aun falta reflejar una tabla visible para cerrar bien el torneo',
          caution: 'No conviene dar por finalizado un torneo si todavia quedan resultados o tabla sin consolidar.'
        };
      case 'CANCELLED':
        return {
          title: 'Operacion detenida',
          summary: 'Este torneo salio del flujo principal. Conviene tratarlo como referencia historica o limpieza operativa.',
          readiness: 'Mantenerlo aislado del radar operativo principal',
          caution: 'Evitar seguir cargando operacion nueva sobre un torneo cancelado.'
        };
      default:
        return {
          title: 'Seguimiento operativo',
          summary: 'El torneo requiere lectura operativa manual.',
          readiness: 'Revisar detalle y continuidad del flujo',
          caution: 'Evitar decisiones sin validar el estado real.'
        };
    }
  });
  protected readonly quickActions = computed<QuickAction[]>(() => {
    const tournament = this.tournament();
    const summary = this.summary();
    const firstRegistration = this.registrationRows()[0];

    if (!tournament) {
      return [];
    }

    const actions: QuickAction[] = [
      {
        label: 'Competencia avanzada',
        description: 'Leer llaves, calendario, generacion inicial y resultados del bloque competitivo.',
        cta: 'Abrir bloque',
        path: `/tournaments/${tournament.id}/competition-advanced`,
        queryParams: qp({})
      },
      {
        label: 'Estadisticas basicas',
        description: 'Leer resumen estadistico, lideres simples y metricas derivadas del torneo.',
        cta: 'Abrir estadisticas',
        path: `/tournaments/${tournament.id}/statistics/basic`,
        queryParams: qp({})
      },
      {
        label: 'Inscripciones',
        description: 'Revisar y aprobar equipos vinculados al torneo.',
        cta: 'Abrir inscripciones',
        path: '/tournament-teams',
        queryParams: qp({ tournamentId: tournament.id })
      },
      {
        label: 'Rosters',
        description: 'Completar o auditar jugadores activos por inscripcion.',
        cta: 'Abrir rosters',
        path: '/rosters',
        queryParams: firstRegistration
          ? qp({ tournamentTeamId: firstRegistration.registration.id, rosterStatus: 'ACTIVE' })
          : qp({ rosterStatus: 'ACTIVE' })
      },
      {
        label: 'Partidos',
        description: 'Programar fixture o revisar resultados cargados.',
        cta: 'Abrir partidos',
        path: '/matches',
        queryParams: qp({ tournamentId: tournament.id })
      },
      {
        label: 'Standings',
        description: 'Validar la tabla del torneo y su cobertura competitiva.',
        cta: 'Abrir standings',
        path: '/standings',
        queryParams: qp({ tournamentId: tournament.id })
      },
      {
        label: 'Disciplina',
        description: 'Revisar sanciones simples y trazables del torneo.',
        cta: 'Abrir disciplina',
        path: `/tournaments/${tournament.id}/discipline`,
        queryParams: qp({})
      }
    ];

    if ((summary?.approvedRegistrationCount ?? 0) === 0) {
      actions[0] = {
        label: 'Nueva inscripcion',
        description: 'El torneo aun no tiene equipos operativos aprobados.',
        cta: 'Crear inscripcion',
        path: '/tournament-teams/new',
        queryParams: qp({ tournamentId: tournament.id })
      };
    }

    const firstApprovedWithoutRoster = this.registrationRows().find(
      (row) => row.registration.registrationStatus === 'APPROVED' && row.activeRosterCount === 0
    );
    if (firstApprovedWithoutRoster) {
      actions[1] = {
        label: 'Completar roster',
        description: 'Existe al menos una inscripcion aprobada sin soporte de roster activo.',
        cta: 'Cargar roster',
        path: '/rosters/new',
        queryParams: qp({ tournamentTeamId: firstApprovedWithoutRoster.registration.id })
      };
    }

    if (tournament.status === 'DRAFT' || tournament.status === 'OPEN') {
      actions[2] = {
        label: 'Preparar fixture',
        description: 'Antes de iniciar operacion conviene dejar visible el bloque de partidos.',
        cta: 'Ir a partidos',
        path: '/matches',
        queryParams: qp({ tournamentId: tournament.id, status: 'SCHEDULED' })
      };
    }

    if ((summary?.playedMatchCount ?? 0) > 0) {
      actions[3] = {
        label: 'Validar standings',
        description: 'Ya existen resultados; conviene confirmar que la tabla este alineada.',
        cta: 'Revisar standings',
        path: '/standings',
        queryParams: qp({ tournamentId: tournament.id })
      };
    }

    return actions;
  });

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
      operationalSummary: this.tournamentsService.getOperationalSummaryById(tournamentId)
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const registrationIds = new Set(result.registrations.map((item) => item.id));
          const tournamentStages = result.stages.filter((item) => item.tournamentId === tournamentId);
          const stageIds = new Set(tournamentStages.map((item) => item.id));
          const tournamentGroups = result.groups.filter((item) => stageIds.has(item.stageId));
          const sportById = new Map(result.sports.map((item) => [item.id, item] as const));
          const teamById = new Map(result.teams.map((item) => [item.id, item] as const));
          const registrationById = new Map(result.registrations.map((item) => [item.id, item] as const));

          this.tournament.set(result.tournament);
          this.sports.set(result.sports);
          this.teams.set(result.teams);
          this.registrations.set(result.registrations);
          this.rosters.set(result.rosters.filter((item) => registrationIds.has(item.tournamentTeamId)));
          this.matches.set(result.matches);
          this.standings.set(result.standings);
          this.stages.set(tournamentStages);
          this.groups.set(tournamentGroups);
          this.summary.set(
            this.dashboardService.buildTournamentSummary({
              tournament: result.tournament,
              sportById,
              teamById,
              registrationById,
              operationalSummary: result.operationalSummary,
              stages: tournamentStages,
              groups: tournamentGroups,
              registrations: result.registrations,
              matches: result.matches,
              standings: result.standings
            })
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
