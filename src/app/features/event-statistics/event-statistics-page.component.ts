import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { MatchGame } from '../matches/match.models';
import { MatchesService } from '../matches/matches.service';
import { Player } from '../players/player.models';
import { PlayersService } from '../players/players.service';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import {
  EventStatisticsMatch,
  EventStatisticsPlayer,
  EventStatisticsResponse,
  EventStatisticsTeam
} from './event-statistics.models';
import { EventStatisticsService } from './event-statistics.service';

type SummaryCard = {
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
};

@Component({
  selector: 'app-event-statistics-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Estadisticas por eventos" [subtitle]="headerSubtitle()">
        <div class="header-actions">
          <a mat-stroked-button [routerLink]="['/tournaments', tournamentId()]">Volver al torneo</a>
          <a mat-stroked-button routerLink="/matches" [queryParams]="{ tournamentId: tournamentId() }">Ver partidos</a>
          <a mat-stroked-button [routerLink]="['/tournaments', tournamentId(), 'statistics', 'basic']">
            Estadisticas basicas
          </a>
        </div>
      </app-page-header>

      @if (loading()) {
        <app-loading-state label="Cargando estadisticas derivadas..." />
      } @else if (!tournament()) {
        <section class="card page-card app-page">
          <div class="empty-state">
            <strong>No se encontro el torneo solicitado.</strong>
            <p class="muted">Abre nuevamente la lectura desde el detalle del torneo para conservar el contexto oficial.</p>
          </div>
        </section>
      } @else {
        <section class="card page-card app-page">
          <div class="context-banner">
            <strong>{{ tournament()!.name }}</strong>
            <span class="muted">
              Goleadores, tarjetas y resumenes derivados desde eventos activos del partido.
            </span>
          </div>

          <form [formGroup]="filtersForm" class="filter-row">
            <mat-form-field appearance="outline">
              <mat-label>Partido</mat-label>
              <mat-select formControlName="matchId">
                <mat-option value="">Todos</mat-option>
                @for (match of matches(); track match.id) {
                  <mat-option [value]="match.id">{{ matchLabel(match) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Equipo</mat-label>
              <mat-select formControlName="tournamentTeamId">
                <mat-option value="">Todos</mat-option>
                @for (registration of tournamentTeams(); track registration.id) {
                  <mat-option [value]="registration.id">{{ tournamentTeamLabel(registration.id) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Jugador</mat-label>
              <mat-select formControlName="playerId">
                <mat-option value="">Todos</mat-option>
                @for (player of players(); track player.id) {
                  <mat-option [value]="player.id">{{ playerName(player.id) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </form>

          <div class="actions-row">
            <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
            <button mat-flat-button color="primary" type="button" (click)="loadStatistics()">Actualizar lectura</button>
          </div>

          @if (errorMessage()) {
            <div class="empty-state error-state">
              <strong>No se pudo cargar la lectura.</strong>
              <p class="muted">{{ errorMessage() }}</p>
            </div>
          }

          @if (statistics()) {
            <div class="summary-grid">
              @for (card of summaryCards(); track card.label) {
                <article class="summary-card card" [class.accent]="card.accent">
                  <span class="summary-label">{{ card.label }}</span>
                  <span class="summary-value">{{ card.value }}</span>
                  <span class="summary-meta">{{ card.meta }}</span>
                </article>
              }
            </div>

            <div class="context-banner neutral-banner">
              <strong>Lectura read-only</strong>
              <span class="muted">
                Fuente {{ traceabilitySource() }}. Excluye {{ excludedStatusesLabel() }} y no modifica resultados ni tabla.
              </span>
            </div>
          }
        </section>

        @if (statistics()) {
          <section class="content-grid">
            <section class="card page-card app-page">
              <div class="section-heading">
                <div>
                  <h2>Goleadores</h2>
                  <p class="muted">Ranking simple desde eventos SCORE activos.</p>
                </div>
                <span class="muted">{{ filterScopeLabel() }}</span>
              </div>

              @if (topScorers().length === 0) {
                <div class="empty-state">
                  <strong>Sin goles activos para este filtro.</strong>
                  <p class="muted">Cuando el backend reporte eventos SCORE activos, apareceran aqui.</p>
                </div>
              } @else {
                <div class="table-wrapper">
                  <table class="detail-table">
                    <thead>
                      <tr>
                        <th>Jugador</th>
                        <th>Equipo</th>
                        <th>Goles</th>
                        <th>Eventos</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (player of topScorers(); track player.playerId) {
                        <tr>
                          <td>{{ playerLabel(player) }}</td>
                          <td>{{ playerTeamLabel(player) }}</td>
                          <td><strong>{{ player.goals }}</strong></td>
                          <td>{{ player.activeEvents }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>

            <section class="card page-card app-page">
              <div class="section-heading">
                <div>
                  <h2>Tarjetas por jugador</h2>
                  <p class="muted">Amarillas y rojas derivadas de eventos activos.</p>
                </div>
              </div>

              @if (disciplinePlayers().length === 0) {
                <div class="empty-state">
                  <strong>Sin tarjetas activas para este filtro.</strong>
                  <p class="muted">El contrato no reporta YELLOW_CARD ni RED_CARD activos en este alcance.</p>
                </div>
              } @else {
                <div class="table-wrapper">
                  <table class="detail-table">
                    <thead>
                      <tr>
                        <th>Jugador</th>
                        <th>Equipo</th>
                        <th>Amarillas</th>
                        <th>Rojas</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (player of disciplinePlayers(); track player.playerId) {
                        <tr>
                          <td>{{ playerLabel(player) }}</td>
                          <td>{{ playerTeamLabel(player) }}</td>
                          <td>{{ player.yellowCards }}</td>
                          <td>{{ player.redCards }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>

            <section class="card page-card app-page">
              <div class="section-heading">
                <div>
                  <h2>Resumen por equipo</h2>
                  <p class="muted">Totales operativos por equipo inscrito.</p>
                </div>
              </div>

              @if (statistics()!.teams.length === 0) {
                <div class="empty-state">
                  <strong>Sin resumen por equipo.</strong>
                  <p class="muted">No hay eventos activos agregables para equipos en este filtro.</p>
                </div>
              } @else {
                <div class="team-grid">
                  @for (team of teamSummary(); track team.tournamentTeamId) {
                    <article class="stat-row-card">
                      <strong>{{ teamLabel(team) }}</strong>
                      <span class="muted">Goles {{ team.goals }} / Amarillas {{ team.yellowCards }} / Rojas {{ team.redCards }}</span>
                      <span class="muted">{{ team.activeEvents }} evento(s) activos</span>
                    </article>
                  }
                </div>
              }
            </section>

            <section class="card page-card app-page">
              <div class="section-heading">
                <div>
                  <h2>Resumen por partido</h2>
                  <p class="muted">Lectura simple del agregado por partido cuando el contrato lo permite.</p>
                </div>
              </div>

              @if (statistics()!.matches.length === 0) {
                <div class="empty-state">
                  <strong>Sin resumen por partido.</strong>
                  <p class="muted">El backend no reporta partidos con eventos activos para este filtro.</p>
                </div>
              } @else {
                <div class="list-stack">
                  @for (match of matchSummary(); track match.matchId) {
                    <article class="stat-row-card">
                      <strong>{{ statisticsMatchLabel(match) }}</strong>
                      <span class="muted">Goles {{ match.goals }} / Amarillas {{ match.yellowCards }} / Rojas {{ match.redCards }}</span>
                      <span class="muted">{{ formatDate(match.scheduledAt) || 'Sin horario' }}</span>
                    </article>
                  }
                </div>
              }
            </section>
          </section>

          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Trazabilidad</h2>
                <p class="muted">Pistas del contrato para confirmar origen y exclusiones.</p>
              </div>
            </div>

            <div class="traceability-grid">
              <article class="trace-card">
                <span class="summary-label">Fuente</span>
                <strong>{{ traceabilitySource() }}</strong>
                <span class="muted">{{ statistics()!.traceability.derivedFromMatchEvents ? 'Eventos de partido activos' : 'No declarado' }}</span>
              </article>
              <article class="trace-card">
                <span class="summary-label">Tipos incluidos</span>
                <strong>{{ includedTypesLabel() }}</strong>
                <span class="muted">Solo estos tipos alimentan goles y tarjetas.</span>
              </article>
              <article class="trace-card">
                <span class="summary-label">Estados excluidos</span>
                <strong>{{ excludedStatusesLabel() }}</strong>
                <span class="muted">Los eventos anulados no suman.</span>
              </article>
            </div>
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      .header-actions,
      .content-grid,
      .list-stack,
      .team-grid {
        display: grid;
        gap: 1rem;
      }

      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .section-heading {
        display: flex;
        gap: 0.75rem;
        align-items: start;
        justify-content: space-between;
      }

      .section-heading h2,
      .section-heading p {
        margin: 0;
      }

      .neutral-banner {
        margin-top: 0.5rem;
        background: linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(14, 116, 144, 0.02));
        border-color: rgba(14, 116, 144, 0.16);
      }

      .error-state {
        border-color: rgba(194, 65, 12, 0.45);
      }

      .detail-table {
        width: 100%;
        border-collapse: collapse;
      }

      .detail-table th,
      .detail-table td {
        padding: 0.75rem;
        border-bottom: 1px solid var(--border);
        text-align: left;
        vertical-align: top;
      }

      .detail-table th {
        background: rgba(10, 110, 90, 0.04);
        color: var(--text-soft);
        font-size: 0.85rem;
      }

      .stat-row-card,
      .trace-card {
        display: grid;
        gap: 0.45rem;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .traceability-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      @media (max-width: 720px) {
        .section-heading {
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventStatisticsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly eventStatisticsService = inject(EventStatisticsService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly matchesService = inject(MatchesService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly teamsService = inject(TeamsService);
  private readonly playersService = inject(PlayersService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly tournamentId = signal(0);
  protected readonly tournament = signal<Tournament | null>(null);
  protected readonly matches = signal<MatchGame[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly players = signal<Player[]>([]);
  protected readonly statistics = signal<EventStatisticsResponse | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly filtersForm = this.fb.nonNullable.group({
    matchId: [0 as number | ''],
    tournamentTeamId: [0 as number | ''],
    playerId: [0 as number | '']
  });
  protected readonly headerSubtitle = computed(() => {
    const tournament = this.tournament();
    return tournament
      ? `${tournament.name} · lectura read-only desde eventos activos`
      : 'Rankings y resumenes derivados de eventos de partido.';
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const summary = this.statistics()?.summary;
    if (!summary) {
      return [];
    }

    return [
      {
        label: 'Goles',
        value: String(summary.goals),
        meta: 'Eventos SCORE activos',
        accent: true
      },
      {
        label: 'Amarillas',
        value: String(summary.yellowCards),
        meta: 'Eventos YELLOW_CARD activos'
      },
      {
        label: 'Rojas',
        value: String(summary.redCards),
        meta: 'Eventos RED_CARD activos'
      },
      {
        label: 'Eventos activos',
        value: String(summary.activeEvents),
        meta: 'Trazabilidad del filtro actual'
      }
    ];
  });
  protected readonly topScorers = computed(() =>
    [...(this.statistics()?.players ?? [])]
      .filter((player) => player.goals > 0)
      .sort((left, right) => right.goals - left.goals || right.activeEvents - left.activeEvents)
  );
  protected readonly disciplinePlayers = computed(() =>
    [...(this.statistics()?.players ?? [])]
      .filter((player) => player.yellowCards > 0 || player.redCards > 0)
      .sort((left, right) => right.redCards - left.redCards || right.yellowCards - left.yellowCards)
  );
  protected readonly teamSummary = computed(() =>
    [...(this.statistics()?.teams ?? [])].sort((left, right) => right.goals - left.goals || right.activeEvents - left.activeEvents)
  );
  protected readonly matchSummary = computed(() =>
    [...(this.statistics()?.matches ?? [])].sort((left, right) => right.activeEvents - left.activeEvents || right.goals - left.goals)
  );

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.tournamentId.set(Number(params.get('id')));
      this.loadContext();
    });
  }

  protected loadStatistics(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.eventStatisticsService
      .getEventStatistics(tournamentId, this.filtersForm.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (statistics) => this.statistics.set(statistics),
        error: (error: unknown) => {
          const mapped = this.errorMapper.map(error);
          this.statistics.set(null);
          this.errorMessage.set(mapped.message);
          this.notifications.error(mapped.message);
        }
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ matchId: '', tournamentTeamId: '', playerId: '' });
    this.loadStatistics();
  }

  protected filterScopeLabel(): string {
    const filters = this.statistics()?.filters;
    if (!filters) {
      return 'Sin filtro cargado';
    }

    const labels = [
      filters.matchId ? `Partido #${filters.matchId}` : '',
      filters.tournamentTeamId ? this.tournamentTeamLabel(filters.tournamentTeamId) : '',
      filters.playerId ? this.playerName(filters.playerId) : ''
    ].filter((label) => Boolean(label));

    return labels.length > 0 ? labels.join(' / ') : 'Torneo completo';
  }

  protected matchLabel(match: MatchGame): string {
    return `#${match.id} · ${this.tournamentTeamLabel(match.homeTournamentTeamId)} vs ${this.tournamentTeamLabel(match.awayTournamentTeamId)}`;
  }

  protected statisticsMatchLabel(match: EventStatisticsMatch): string {
    const existing = this.matches().find((item) => item.id === match.matchId);
    if (existing) {
      return this.matchLabel(existing);
    }

    return `Partido #${match.matchId}`;
  }

  protected tournamentTeamLabel(tournamentTeamId: number | null): string {
    if (!tournamentTeamId) {
      return 'Equipo no declarado';
    }

    const registration = this.tournamentTeams().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `Equipo #${tournamentTeamId}`;
    }

    const team = this.teams().find((item) => item.id === registration.teamId);
    return team ? `${team.name} (#${registration.id})` : `Equipo ${registration.teamId} (#${registration.id})`;
  }

  protected playerName(playerId: number | null): string {
    if (!playerId) {
      return 'Jugador no declarado';
    }

    const player = this.players().find((item) => item.id === playerId);
    if (!player) {
      return `Jugador #${playerId}`;
    }

    return `${player.firstName} ${player.lastName}`.trim();
  }

  protected playerLabel(player: EventStatisticsPlayer): string {
    return player.displayName || [player.firstName, player.lastName].filter(Boolean).join(' ') || this.playerName(player.playerId);
  }

  protected playerTeamLabel(player: EventStatisticsPlayer): string {
    return player.teamName || player.teamShortName || this.tournamentTeamLabel(player.tournamentTeamId);
  }

  protected teamLabel(team: EventStatisticsTeam): string {
    return team.teamName || team.teamShortName || this.tournamentTeamLabel(team.tournamentTeamId);
  }

  protected traceabilitySource(): string {
    return this.statistics()?.traceability.source || 'match_event';
  }

  protected includedTypesLabel(): string {
    return this.statistics()?.traceability.includedEventTypes.join(', ') || 'SCORE, YELLOW_CARD, RED_CARD';
  }

  protected excludedStatusesLabel(): string {
    return this.statistics()?.traceability.excludedStatuses.join(', ') || 'ANNULLED';
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

  private loadContext(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      this.loading.set(false);
      this.tournament.set(null);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    forkJoin({
      tournament: this.tournamentsService.getById(tournamentId),
      matches: this.catalogLoader.loadAll((page, size) => this.matchesService.list({ tournamentId, page, size })),
      registrations: this.catalogLoader.loadAll((page, size) =>
        this.tournamentTeamsService.list({ tournamentId, page, size })
      ),
      teams: this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })),
      players: this.catalogLoader.loadAll((page, size) => this.playersService.list({ page, size }))
    })
      .subscribe({
        next: (result) => {
          this.tournament.set(result.tournament);
          this.matches.set(result.matches);
          this.tournamentTeams.set(result.registrations);
          this.teams.set(result.teams);
          this.players.set(result.players);
          this.filtersForm.setValue({ matchId: '', tournamentTeamId: '', playerId: '' }, { emitEvent: false });
          this.loadStatistics();
        },
        error: (error: unknown) => {
          const mapped = this.errorMapper.map(error);
          this.loading.set(false);
          this.tournament.set(null);
          this.statistics.set(null);
          this.errorMessage.set(mapped.message);
          this.notifications.error(mapped.message);
        }
      });
  }
}
