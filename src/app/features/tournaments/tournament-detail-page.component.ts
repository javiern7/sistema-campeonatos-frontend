import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';

import { AuthorizationResource, AuthorizationService } from '../../core/auth/authorization.service';
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
  resource?: AuthorizationResource;
  action?: 'read' | 'manage';
};

type FlowStepStatus = 'pending' | 'ready' | 'attention' | 'notApplicable';

type FlowStep = {
  label: string;
  status: FlowStepStatus;
  description: string;
  actionLabel: string;
  path: string;
  queryParams: Record<string, string | number>;
  resource?: AuthorizationResource;
  action?: 'read' | 'manage';
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
        <app-page-header title="Detalle de campeonato" subtitle="Cargando contexto consolidado..." />
        <app-loading-state />
      } @else if (!tournament()) {
        <app-page-header title="Detalle de campeonato" subtitle="No se encontro el campeonato solicitado." />
        <section class="card page-card app-page">
          <div class="empty-state">
            <strong>El campeonato no esta disponible.</strong>
            <p class="muted">Verifica el identificador o vuelve al listado principal de campeonatos.</p>
            <a mat-flat-button color="primary" routerLink="/tournaments">Volver a campeonatos</a>
          </div>
        </section>
      } @else {
        <app-page-header [title]="tournament()!.name" [subtitle]="headerSubtitle()">
          <div class="header-actions">
            <a mat-stroked-button routerLink="/tournaments">Volver</a>
            <a mat-stroked-button [routerLink]="['/tournaments', tournament()!.id, 'edit']">Editar campeonato</a>
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
                  <span class="segment-pill sandbox">Borrador o pruebas</span>
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
                [routerLink]="['/tournaments', tournament()!.id, 'statistics', 'events']"
              >
                Estadisticas eventos
              </a>
              <a
                mat-stroked-button
                [routerLink]="['/tournaments', tournament()!.id, 'discipline']"
              >
                Disciplina
              </a>
              <a
                mat-stroked-button
                [routerLink]="['/tournaments', tournament()!.id, 'finances', 'basic']"
              >
                Finanzas basicas
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
                Ver tabla
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
              <p>{{ summary()?.nextAction || 'Completar el flujo torneo -> inscripcion -> plantel -> partido -> tabla.' }}</p>
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
              <h2>Guia de gestion del campeonato</h2>
              <p class="muted">Pasos recomendados desde la configuracion inicial hasta la operacion diaria.</p>
            </div>
            <span class="flow-progress">{{ flowProgress().ready }}/{{ flowProgress().total }} listos</span>
          </div>

          <div class="flow-progress-track" aria-hidden="true">
            <span [style.width.%]="flowProgress().percent"></span>
          </div>

          <div class="flow-checklist">
            @for (step of flowSteps(); track step.label) {
              <article class="flow-step" [class]="step.status">
                <div class="flow-marker">
                  <span>{{ $index + 1 }}</span>
                </div>
                <div class="flow-body">
                  <div class="flow-step-heading">
                    <strong>{{ step.label }}</strong>
                    <span class="flow-status" [class]="step.status">{{ flowStatusLabel(step.status) }}</span>
                  </div>
                  <p class="muted">{{ step.description }}</p>
                  <a mat-button [routerLink]="step.path" [queryParams]="step.queryParams">{{ step.actionLabel }}</a>
                </div>
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
              <h2>Inscripciones aprobadas y planteles</h2>
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
                    <th>Plantel activo</th>
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
                          {{ row.activeRosterCount > 0 ? 'Ver plantel' : 'Cargar plantel' }}
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
                <h2>Tabla destacada</h2>
                <p class="muted">Lectura rapida del liderazgo actual del torneo.</p>
              </div>
              <a mat-button routerLink="/standings" [queryParams]="{ tournamentId: tournament()!.id }">Abrir tabla</a>
            </div>

            @if (topStandings().length === 0) {
              <div class="empty-state">
                <strong>No hay tabla cargada.</strong>
                <p class="muted">La tabla aparecera aqui cuando existan resultados cerrados y posiciones calculadas.</p>
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

      .flow-progress {
        display: inline-flex;
        align-items: center;
        padding: 0.4rem 0.75rem;
        border-radius: 999px;
        background: var(--primary-soft);
        color: var(--primary-strong);
        font-size: 0.85rem;
        font-weight: 800;
      }

      .flow-progress-track {
        overflow: hidden;
        height: 0.55rem;
        border-radius: 999px;
        background: var(--surface-alt);
      }

      .flow-progress-track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--primary), var(--accent));
        transition: width 180ms ease;
      }

      .flow-checklist {
        display: grid;
        gap: 0.8rem;
      }

      .flow-step {
        display: grid;
        gap: 0.85rem;
        grid-template-columns: auto minmax(0, 1fr);
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .flow-step.ready {
        border-color: rgba(22, 101, 52, 0.18);
        background: #f0fdf4;
      }

      .flow-step.attention {
        border-color: rgba(146, 64, 14, 0.22);
        background: #fffbeb;
      }

      .flow-step.notApplicable {
        opacity: 0.82;
      }

      .flow-marker {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        background: #ffffff;
        color: var(--primary);
        font-weight: 800;
        box-shadow: inset 0 0 0 1px var(--border);
      }

      .flow-body {
        display: grid;
        gap: 0.45rem;
        min-width: 0;
      }

      .flow-body p {
        margin: 0;
      }

      .flow-body a {
        justify-self: start;
      }

      .flow-step-heading {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        align-items: center;
        justify-content: space-between;
      }

      .flow-status {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        background: #eef2f7;
        color: var(--text-soft);
        font-size: 0.75rem;
        font-weight: 800;
      }

      .flow-status.ready {
        background: #dcfce7;
        color: #166534;
      }

      .flow-status.attention {
        background: #fef3c7;
        color: #92400e;
      }

      .flow-status.pending {
        background: #e0f2fe;
        color: #075985;
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

        .flow-step {
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
  private readonly authorization = inject(AuthorizationService);
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
        label: 'Planteles activos',
        value: summary?.registrationsWithActiveRosterCount ?? 0,
        meta: `${summary?.rosterGapCount ?? 0} brechas activas`
      },
      {
        label: 'Partidos',
        value: summary?.matchCount ?? 0,
        meta: `${summary?.playedMatchCount ?? 0} jugados`
      },
      {
        label: 'Tabla',
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
        label: 'Cobertura de plantel',
        headline: `${summary?.registrationsWithActiveRosterCount ?? 0}/${summary?.approvedRegistrationCount ?? 0} aprobadas cubiertas`,
        detail:
          (summary?.approvedRegistrationCount ?? 0) > 0
            ? `${summary?.rosterGapCount ?? 0} pendientes en la base de jugadores`
            : 'Todavia no hay base aprobada para exigir plantel activo'
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
        label: 'Claridad de tabla',
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
        label: 'Cobertura plantel',
        value: `${coveredCount}/${approvedCount}`,
        detail:
          approvedCount > 0
            ? `${summary?.rosterGapCount ?? 0} pendientes antes de confiar en el calendario`
            : 'Sin base aprobada aun'
      },
      {
        label: 'Cobertura tabla',
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
  protected readonly flowSteps = computed<FlowStep[]>(() => {
    const tournament = this.tournament();
    const summary = this.summary();

    if (!tournament) {
      return [];
    }

    const approvedCount = summary?.approvedRegistrationCount ?? 0;
    const rosterGapCount = summary?.rosterGapCount ?? 0;
    const matchCount = summary?.matchCount ?? this.matches().length;
    const playedMatchCount = summary?.playedMatchCount ?? this.matches().filter((item) => item.status === 'PLAYED' || item.status === 'FORFEIT').length;
    const standingsCount = summary?.standingsCount ?? this.standings().length;
    const hasBasicDates = !!tournament.startDate || !!tournament.endDate;
    const needsGroups = tournament.format === 'GROUPS_THEN_KNOCKOUT';
    const firstApprovedWithoutRoster = this.registrationRows().find(
      (row) => row.registration.registrationStatus === 'APPROVED' && row.activeRosterCount === 0
    );

    const steps: FlowStep[] = [
      {
        label: 'Datos basicos',
        status: tournament.name && tournament.seasonName && tournament.sportId ? 'ready' : 'attention',
        description: hasBasicDates
          ? 'Nombre, deporte, temporada y fechas principales ya orientan la gestion.'
          : 'La base existe, pero conviene completar fechas para dar contexto operativo.',
        actionLabel: 'Editar datos',
        path: `/tournaments/${tournament.id}/edit`,
        queryParams: qp({}),
        resource: 'tournaments',
        action: 'manage'
      },
      {
        label: 'Formato y reglas',
        status: tournament.format && tournament.pointsWin !== null && tournament.pointsDraw !== null && tournament.pointsLoss !== null ? 'ready' : 'attention',
        description: `${this.formatLabel(tournament.format)} con puntajes visibles para victoria, empate y derrota.`,
        actionLabel: 'Revisar reglas',
        path: `/tournaments/${tournament.id}/edit`,
        queryParams: qp({}),
        resource: 'tournaments',
        action: 'manage'
      },
      {
        label: 'Equipos inscritos',
        status: approvedCount > 1 ? 'ready' : this.registrations().length > 0 ? 'attention' : 'pending',
        description:
          approvedCount > 1
            ? `${approvedCount} equipos aprobados para competir.`
            : this.registrations().length > 0
              ? 'Hay inscripciones, pero todavia falta aprobar una base competitiva suficiente.'
              : 'Aun no hay equipos vinculados al campeonato.',
        actionLabel: approvedCount > 0 ? 'Gestionar inscripciones' : 'Agregar equipo',
        path: approvedCount > 0 ? '/tournament-teams' : '/tournament-teams/new',
        queryParams: approvedCount > 0 ? qp({ tournamentId: tournament.id }) : qp({ tournamentId: tournament.id }),
        resource: approvedCount > 0 ? 'tournamentTeams' : 'tournamentTeams',
        action: approvedCount > 0 ? 'read' : 'manage'
      },
      {
        label: 'Planteles',
        status: approvedCount === 0 ? 'notApplicable' : rosterGapCount === 0 ? 'ready' : 'attention',
        description:
          approvedCount === 0
            ? 'Primero se necesita una base de equipos aprobados.'
            : rosterGapCount === 0
              ? 'Los equipos aprobados tienen soporte de plantel activo.'
              : `${rosterGapCount} equipo(s) aprobado(s) todavia requieren plantel activo.`,
        actionLabel: rosterGapCount > 0 ? 'Cargar plantel' : 'Ver planteles',
        path: rosterGapCount > 0 && firstApprovedWithoutRoster ? '/rosters/new' : '/rosters',
        queryParams:
          rosterGapCount > 0 && firstApprovedWithoutRoster
            ? qp({ tournamentTeamId: firstApprovedWithoutRoster.registration.id })
            : qp({ rosterStatus: 'ACTIVE' }),
        resource: 'rosters',
        action: rosterGapCount > 0 ? 'manage' : 'read'
      },
      {
        label: 'Fases y grupos',
        status:
          this.stages().length > 0 && (!needsGroups || this.groups().length > 0)
            ? 'ready'
            : needsGroups || tournament.format === 'KNOCKOUT'
              ? 'attention'
              : 'notApplicable',
        description:
          this.stages().length > 0
            ? `${this.stages().length} etapa(s)${this.groups().length > 0 ? ` y ${this.groups().length} grupo(s)` : ''} configurados.`
            : tournament.format === 'LEAGUE'
              ? 'En formato liga puede operar sin grupos si el calendario esta claro.'
              : 'El formato seleccionado requiere preparar estructura competitiva.',
        actionLabel: this.stages().length > 0 ? 'Ver etapas' : 'Configurar fases',
        path: this.stages().length > 0 ? '/tournament-stages' : '/tournament-stages/new',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'tournamentStages',
        action: this.stages().length > 0 ? 'read' : 'manage'
      },
      {
        label: 'Calendario y partidos',
        status: matchCount > 0 ? 'ready' : approvedCount > 1 ? 'attention' : 'pending',
        description:
          matchCount > 0
            ? `${matchCount} partido(s) visibles para seguimiento.`
            : approvedCount > 1
              ? 'Ya hay equipos para empezar a programar partidos.'
              : 'Primero completa equipos y planteles antes del calendario.',
        actionLabel: matchCount > 0 ? 'Ver partidos' : 'Programar partido',
        path: matchCount > 0 ? '/matches' : '/matches/new',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'matches',
        action: matchCount > 0 ? 'read' : 'manage'
      },
      {
        label: 'Resultados',
        status: matchCount === 0 ? 'notApplicable' : playedMatchCount > 0 ? 'ready' : 'attention',
        description:
          matchCount === 0
            ? 'Aun no hay partidos para registrar resultados.'
            : playedMatchCount > 0
              ? `${playedMatchCount} resultado(s) ya alimentan la lectura competitiva.`
              : 'Hay partidos, pero todavia falta registrar resultados.',
        actionLabel: playedMatchCount > 0 ? 'Revisar resultados' : 'Registrar resultado',
        path: '/matches',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'matches',
        action: playedMatchCount > 0 ? 'read' : 'manage'
      },
      {
        label: 'Tabla y estadisticas',
        status: standingsCount > 0 ? 'ready' : playedMatchCount > 0 ? 'attention' : 'pending',
        description:
          standingsCount > 0
            ? `${standingsCount} registro(s) de tabla disponibles para ${tournament.name}.`
            : playedMatchCount > 0
              ? `Ya hay resultados en ${tournament.name}; conviene preparar o recalcular su tabla.`
              : `La tabla de ${tournament.name} se vuelve relevante cuando existan resultados.`,
        actionLabel: standingsCount > 0 ? 'Ver tabla' : 'Preparar tabla',
        path: '/standings',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'standings',
        action: 'read'
      },
      {
        label: 'Reportes',
        status: matchCount > 0 || standingsCount > 0 ? 'ready' : 'pending',
        description:
          matchCount > 0 || standingsCount > 0
            ? 'Ya existe informacion para seguimiento y reportes del campeonato.'
            : 'Los reportes toman valor cuando la operacion empieza a generar actividad.',
        actionLabel: 'Ver reportes',
        path: `/tournaments/${tournament.id}/reports`,
        queryParams: qp({}),
        resource: 'tournaments',
        action: 'read'
      },
      {
        label: 'Portal publico',
        status: tournament.slug ? 'ready' : 'attention',
        description: tournament.slug
          ? 'El campeonato tiene una direccion publica disponible para consulta externa.'
          : 'No se detecto direccion publica para compartir.',
        actionLabel: 'Ver portal',
        path: tournament.slug ? `/portal/tournaments/${tournament.slug}` : '/portal',
        queryParams: qp({})
      }
    ];

    return steps.filter((step) => this.canUseFlowStep(step));
  });
  protected readonly flowProgress = computed(() => {
    const steps = this.flowSteps();
    const applicable = steps.filter((step) => step.status !== 'notApplicable');
    const ready = applicable.filter((step) => step.status === 'ready').length;
    const total = applicable.length || 1;

    return {
      ready,
      total,
      percent: Math.round((ready / total) * 100)
    };
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
          summary: 'El campeonato aun esta en configuracion. Conviene cerrar la base competitiva antes de publicarlo.',
          readiness:
            (summary?.approvedRegistrationCount ?? 0) > 0
              ? 'Ya tiene base para abrir inscripciones al flujo operativo'
              : 'Todavia falta poblar inscripciones para salir del borrador',
          caution: 'No conviene mezclar carga de partidos o tabla mientras la base siga incompleta.'
        };
      case 'OPEN':
        return {
          title: 'Abierto para consolidar base',
          summary: 'El campeonato ya puede recibir y aprobar inscripciones. El foco deberia estar en dejar planteles y calendario listos.',
          readiness:
            (summary?.rosterGapCount ?? 0) === 0 && (summary?.approvedRegistrationCount ?? 0) > 1
              ? 'La base parece lista para programar partidos'
              : 'Aun conviene cerrar inscripciones aprobadas y plantel activo',
          caution: 'Iniciar competencia sin planteles o sin participantes aprobados reduce la confianza posterior.'
        };
      case 'IN_PROGRESS':
        return {
          title: 'Competencia en curso',
          summary: 'La prioridad es sostener continuidad entre resultados, incidencias y lectura de tabla.',
          readiness:
            (summary?.playedMatchCount ?? 0) > 0
              ? 'Ya hay actividad real para auditar en tabla y continuidad operativa'
              : 'El estado indica competencia activa, pero todavia falta evidencia visible de partidos jugados',
          caution: 'Resultados sin tabla o sin planteles generan la mayor perdida de confianza.'
        };
      case 'FINISHED':
        return {
          title: 'Cierre competitivo',
          summary: 'El torneo ya deberia leerse como ciclo cerrado, con tabla completa y sin brechas visibles.',
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
        queryParams: qp({}),
        resource: 'tournaments',
        action: 'read'
      },
      {
        label: 'Estadisticas basicas',
        description: 'Leer resumen estadistico, lideres simples y metricas derivadas del torneo.',
        cta: 'Abrir estadisticas',
        path: `/tournaments/${tournament.id}/statistics/basic`,
        queryParams: qp({}),
        resource: 'tournaments',
        action: 'read'
      },
      {
        label: 'Inscripciones',
        description: 'Revisar y aprobar equipos vinculados al torneo.',
        cta: 'Abrir inscripciones',
        path: '/tournament-teams',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'tournamentTeams',
        action: 'read'
      },
      {
        label: 'Planteles',
        description: 'Completar o revisar jugadores activos por inscripcion.',
        cta: 'Abrir planteles',
        path: '/rosters',
        queryParams: firstRegistration
          ? qp({ tournamentTeamId: firstRegistration.registration.id, rosterStatus: 'ACTIVE' })
          : qp({ rosterStatus: 'ACTIVE' }),
        resource: 'rosters',
        action: 'read'
      },
      {
        label: 'Estadisticas eventos',
        description: 'Leer goleadores, tarjetas y resumenes derivados de eventos activos.',
        cta: 'Abrir lectura',
        path: `/tournaments/${tournament.id}/statistics/events`,
        queryParams: qp({}),
        resource: 'matches',
        action: 'read'
      },
      {
        label: 'Partidos',
        description: 'Programar fixture o revisar resultados cargados.',
        cta: 'Abrir partidos',
        path: '/matches',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'matches',
        action: 'read'
      },
      {
        label: 'Tabla',
        description: `Validar la tabla de ${tournament.name} y su cobertura competitiva.`,
        cta: 'Abrir tabla',
        path: '/standings',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'standings',
        action: 'read'
      },
      {
        label: 'Reportes',
        description: 'Preparar lectura de cierre, exportaciones y seguimiento del campeonato.',
        cta: 'Ver reportes',
        path: `/tournaments/${tournament.id}/reports`,
        queryParams: qp({}),
        resource: 'tournaments',
        action: 'read'
      },
      {
        label: 'Portal publico',
        description: 'Abrir la vista publica para revisar como se muestra el campeonato hacia afuera.',
        cta: 'Ver portal',
        path: tournament.slug ? `/portal/tournaments/${tournament.slug}` : '/portal',
        queryParams: qp({})
      }
    ];

    if ((summary?.approvedRegistrationCount ?? 0) === 0) {
      actions[0] = {
        label: 'Nueva inscripcion',
        description: 'El torneo aun no tiene equipos operativos aprobados.',
        cta: 'Crear inscripcion',
        path: '/tournament-teams/new',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'tournamentTeams',
        action: 'manage'
      };
    }

    const firstApprovedWithoutRoster = this.registrationRows().find(
      (row) => row.registration.registrationStatus === 'APPROVED' && row.activeRosterCount === 0
    );
    if (firstApprovedWithoutRoster) {
      actions[1] = {
        label: 'Completar plantel',
        description: 'Existe al menos una inscripcion aprobada sin plantel activo.',
        cta: 'Cargar plantel',
        path: '/rosters/new',
        queryParams: qp({ tournamentTeamId: firstApprovedWithoutRoster.registration.id }),
        resource: 'rosters',
        action: 'manage'
      };
    }

    if (tournament.status === 'DRAFT' || tournament.status === 'OPEN') {
      actions[2] = {
        label: 'Preparar fixture',
        description: 'Antes de iniciar operacion conviene dejar visible el bloque de partidos.',
        cta: 'Ir a partidos',
        path: '/matches',
        queryParams: qp({ tournamentId: tournament.id, status: 'SCHEDULED' }),
        resource: 'matches',
        action: 'read'
      };
    }

    if ((summary?.playedMatchCount ?? 0) > 0) {
      actions[3] = {
        label: 'Validar tabla',
        description: 'Ya existen resultados; conviene confirmar que la tabla este alineada.',
        cta: 'Revisar tabla',
        path: '/standings',
        queryParams: qp({ tournamentId: tournament.id }),
        resource: 'standings',
        action: 'read'
      };
    }

    return actions.filter((action) => this.canUseAction(action));
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
      GROUPS_THEN_KNOCKOUT: 'Grupos + eliminatoria',
      KNOCKOUT: 'Eliminatoria'
    };

    return labels[format];
  }

  protected statusLabel(status: Tournament['status']): string {
    const labels: Record<Tournament['status'], string> = {
      DRAFT: 'Borrador',
      OPEN: 'Inscripciones abiertas',
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
      FORFEIT: 'Resultado por ausencia',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  protected matchStatusClass(status: MatchGame['status']): string {
    return `status-pill ${status.toLowerCase()}`;
  }

  protected flowStatusLabel(status: FlowStepStatus): string {
    const labels: Record<FlowStepStatus, string> = {
      pending: 'Pendiente',
      ready: 'Listo',
      attention: 'Requiere atencion',
      notApplicable: 'No aplica'
    };

    return labels[status];
  }

  private canUseAction(action: QuickAction): boolean {
    if (!action.resource || !action.action) {
      return true;
    }

    return action.action === 'manage'
      ? this.authorization.canManage(action.resource)
      : this.authorization.canRead(action.resource);
  }

  private canUseFlowStep(step: FlowStep): boolean {
    if (!step.resource || !step.action) {
      return true;
    }

    return step.action === 'manage'
      ? this.authorization.canManage(step.resource)
      : this.authorization.canRead(step.resource);
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
