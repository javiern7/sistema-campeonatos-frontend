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
  StatisticsBasicLeader,
  StatisticsBasicLeaderStatus,
  StatisticsBasicResponse
} from './statistics-basic.models';
import { StatisticsBasicService } from './statistics-basic.service';

type SummaryCard = {
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
};

type LeaderCard = {
  key: string;
  title: string;
  leader: StatisticsBasicLeader | null;
};

@Component({
  selector: 'app-statistics-basic-page',
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
      <app-page-header title="Estadisticas basicas" [subtitle]="headerSubtitle()">
        <div class="header-actions">
          <a mat-stroked-button [routerLink]="['/tournaments', tournamentId()]">Volver al torneo</a>
          <a mat-stroked-button routerLink="/matches" [queryParams]="contextQueryParams()">Ver partidos</a>
          <a mat-stroked-button routerLink="/standings" [queryParams]="contextQueryParams()">Ver standings</a>
        </div>
      </app-page-header>

      @if (loading()) {
        <app-loading-state label="Cargando lectura estadistica..." />
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
              Resumen estadistico por torneo, lideres simples y metricas derivadas sin convertir esta pantalla en BI transversal.
            </span>
          </div>

          <form [formGroup]="filtersForm" class="filter-row">
            <mat-form-field appearance="outline">
              <mat-label>Etapa</mat-label>
              <mat-select formControlName="stageId">
                <mat-option value="">Todas</mat-option>
                @for (stage of stages(); track stage.id) {
                  <mat-option [value]="stage.id">{{ stage.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Grupo</mat-label>
              <mat-select formControlName="groupId" [disabled]="!selectedStageId()">
                <mat-option value="">Todos</mat-option>
                @for (group of filteredGroups(); track group.id) {
                  <mat-option [value]="group.id">{{ group.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </form>

          <div class="actions-row">
            <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
            <button mat-flat-button color="primary" type="button" (click)="load()">Actualizar lectura</button>
          </div>

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
              <strong>Guardrail operativo</strong>
              <span class="muted">
                El frontend solo lee el agregado /statistics/basic; no recompone metricas desde matches, results o standings.
              </span>
            </div>
          }
        </section>

        @if (statistics()) {
          <section class="content-grid">
            <section class="card page-card app-page">
              <div class="section-heading">
                <div>
                  <h2>Lideres simples</h2>
                  <p class="muted">Lectura visible acotada del liderazgo por equipo, respetando el estado entregado por backend.</p>
                </div>
                <span class="muted">{{ scopeLabel() }}</span>
              </div>

              <div class="leaders-grid">
                @for (card of leaderCards(); track card.key) {
                  <article class="leader-card">
                    <div class="section-heading compact">
                      <strong>{{ card.title }}</strong>
                      <span [class]="leaderStatusClass(card.leader?.status ?? 'NOT_APPLICABLE')">
                        {{ leaderStatusLabel(card.leader?.status ?? 'NOT_APPLICABLE') }}
                      </span>
                    </div>

                    <strong class="leader-value">{{ leaderValue(card.leader) }}</strong>
                    <span class="leader-team">{{ leaderTeamLabel(card.leader) }}</span>
                    <span class="muted">{{ leaderMeta(card.leader) }}</span>
                  </article>
                }
              </div>
            </section>

            <section class="card page-card app-page">
              <div class="section-heading">
                <div>
                  <h2>Trazabilidad</h2>
                  <p class="muted">Pistas visibles para validar de donde sale la lectura estadistica y si el scope actual sigue siendo comparable.</p>
                </div>
              </div>

              <div class="traceability-grid">
                <article class="trace-card">
                  <span class="summary-label">Fuente de partidos</span>
                  <strong>{{ statistics()!.traceability.derivedFromMatches ? 'Activa' : 'No declarada' }}</strong>
                  <span class="muted">El resumen se apoya en match_game segun el contrato backend.</span>
                </article>

                <article class="trace-card">
                  <span class="summary-label">Fuente de standings</span>
                  <strong>{{ statistics()!.traceability.derivedFromStandings ? 'Activa' : 'No aplicable' }}</strong>
                  <span class="muted">Los lideres solo usan standings cuando el scope es comparable.</span>
                </article>

                <article class="trace-card">
                  <span class="summary-label">Classification source</span>
                  <strong>{{ classificationSourceLabel() }}</strong>
                  <span class="muted">Ayuda a confirmar si la lectura viene de torneo, etapa, grupo o un contexto especial.</span>
                </article>
              </div>

              @if (statistics()!.traceability.notes.length === 0) {
                <div class="empty-state">
                  <strong>Sin notas adicionales.</strong>
                  <p class="muted">El backend no reporto observaciones extra para este contexto.</p>
                </div>
              } @else {
                <div class="list-stack">
                  @for (note of statistics()!.traceability.notes; track note) {
                    <article class="list-card">
                      <strong>Nota de trazabilidad</strong>
                      <span class="muted">{{ note }}</span>
                    </article>
                  }
                </div>
              }
            </section>
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .content-grid,
      .leaders-grid,
      .traceability-grid {
        display: grid;
        gap: 1rem;
      }

      .leaders-grid,
      .traceability-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

      .compact {
        align-items: center;
      }

      .neutral-banner {
        margin-top: 0.5rem;
        background: linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(14, 116, 144, 0.02));
        border-color: rgba(14, 116, 144, 0.16);
      }

      .leader-card,
      .trace-card,
      .list-card {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border-radius: 16px;
        background: var(--surface-alt);
      }

      .leader-value {
        font-size: 1.8rem;
        line-height: 1;
      }

      .leader-team {
        font-weight: 700;
      }

      .list-stack {
        display: grid;
        gap: 0.85rem;
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
export class StatisticsBasicPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly statisticsBasicService = inject(StatisticsBasicService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly teamsService = inject(TeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly tournament = signal<Tournament | null>(null);
  protected readonly stages = signal<TournamentStage[]>([]);
  protected readonly groups = signal<StageGroup[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly statistics = signal<StatisticsBasicResponse | null>(null);
  protected readonly tournamentId = signal(0);
  protected readonly selectedStageId = computed(() => Number(this.filtersForm.controls.stageId.getRawValue() || 0));
  protected readonly filteredGroups = computed(() => {
    const stageId = this.selectedStageId();
    return stageId ? this.groups().filter((group) => group.stageId === stageId) : [];
  });
  protected readonly headerSubtitle = computed(() => {
    const tournament = this.tournament();
    if (!tournament) {
      return 'Resumen estadistico basico, lideres simples y trazabilidad por torneo.';
    }

    return `${tournament.name} · ${this.formatLabel(tournament.format)} · ${this.statusTournamentLabel(tournament.status)}`;
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const summary = this.statistics()?.summary;
    if (!summary) {
      return [];
    }

    return [
      {
        label: 'Equipos registrados',
        value: String(summary.registeredTeams),
        meta: 'Base visible del scope actual',
        accent: true
      },
      {
        label: 'Partidos totales',
        value: String(summary.totalMatches),
        meta: `${summary.playedMatches} jugados / ${summary.scheduledMatches} pendientes`
      },
      {
        label: 'Forfeit y cancelados',
        value: `${summary.forfeitMatches} / ${summary.cancelledMatches}`,
        meta: 'Incidencias cerradas del bloque'
      },
      {
        label: 'Anotacion a favor',
        value: String(summary.scoredPointsFor),
        meta: `${summary.scoredPointsAgainst} en contra`
      },
      {
        label: 'Promedio por jugado',
        value: this.decimalLabel(summary.averagePointsPerPlayedMatch),
        meta: 'Promedio simple del contrato'
      },
      {
        label: 'Ultimo cierre',
        value: summary.lastPlayedAt ? this.formatDate(summary.lastPlayedAt) : 'Sin cierre',
        meta: this.scopeLabel()
      }
    ];
  });
  protected readonly leaderCards = computed<LeaderCard[]>(() => {
    const leaders = this.statistics()?.leaders;
    return [
      { key: 'points', title: 'Lider por puntos', leader: leaders?.pointsLeader ?? null },
      { key: 'wins', title: 'Lider por victorias', leader: leaders?.winsLeader ?? null },
      { key: 'diff', title: 'Lider por diferencial', leader: leaders?.scoreDiffLeader ?? null },
      { key: 'scoring', title: 'Lider por anotacion', leader: leaders?.scoringLeader ?? null }
    ];
  });
  protected readonly filtersForm = this.fb.nonNullable.group({
    stageId: [0 as number | ''],
    groupId: [0 as number | '']
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.tournamentId.set(Number(params.get('id')));
      this.loadContext();
    });

    this.filtersForm.controls.stageId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const currentGroupId = Number(this.filtersForm.controls.groupId.getRawValue());
      const validGroupIds = new Set(this.filteredGroups().map((group) => group.id));
      if (currentGroupId && !validGroupIds.has(currentGroupId)) {
        this.filtersForm.patchValue({ groupId: '' }, { emitEvent: false });
      }
    });
  }

  protected load(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      return;
    }

    this.loading.set(true);
    this.statisticsBasicService
      .getBasicStatistics(tournamentId, this.filtersForm.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (statistics) => this.statistics.set(statistics),
        error: (error: unknown) => {
          this.statistics.set(null);
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ stageId: '', groupId: '' });
    this.load();
  }

  protected contextQueryParams(): Record<string, number | null> {
    return {
      tournamentId: this.tournamentId(),
      stageId: this.selectedStageId() || null,
      groupId: Number(this.filtersForm.controls.groupId.getRawValue() || 0) || null
    };
  }

  protected scopeLabel(): string {
    const statistics = this.statistics();
    if (!statistics) {
      return 'Sin scope cargado';
    }

    const labels = [
      this.stageName(statistics.stageId),
      this.groupName(statistics.groupId)
    ].filter((label) => Boolean(label));

    return labels.length > 0 ? labels.join(' / ') : 'Torneo completo';
  }

  protected leaderStatusLabel(status: StatisticsBasicLeaderStatus): string {
    const labels: Record<string, string> = {
      AVAILABLE: 'Disponible',
      PENDING_RECALCULATION: 'Pendiente recalculo',
      NOT_APPLICABLE: 'No aplicable'
    };

    return labels[status] ?? status;
  }

  protected leaderStatusClass(status: StatisticsBasicLeaderStatus): string {
    const statusClassMap: Record<string, string> = {
      AVAILABLE: 'status-pill played',
      PENDING_RECALCULATION: 'status-pill scheduled',
      NOT_APPLICABLE: 'status-pill cancelled'
    };

    return statusClassMap[status] ?? 'status-pill forfeit';
  }

  protected leaderValue(leader: StatisticsBasicLeader | null): string {
    if (!leader || leader.value === null || leader.status !== 'AVAILABLE') {
      return '--';
    }

    return this.decimalLabel(leader.value);
  }

  protected leaderTeamLabel(leader: StatisticsBasicLeader | null): string {
    if (!leader) {
      return 'Sin lectura disponible';
    }

    const explicitLabel =
      leader.team?.label ?? leader.team?.teamName ?? leader.team?.name ?? leader.team?.shortName ?? null;
    if (explicitLabel) {
      return explicitLabel;
    }

    const tournamentTeamId = leader.team?.tournamentTeamId ?? null;
    if (tournamentTeamId) {
      return this.tournamentTeamLabel(tournamentTeamId);
    }

    const teamId = leader.team?.teamId ?? null;
    if (teamId) {
      return this.teams().find((team) => team.id === teamId)?.name ?? `Equipo ${teamId}`;
    }

    return leader.status === 'NOT_APPLICABLE' ? 'No aplica para este scope' : 'Equipo pendiente';
  }

  protected leaderMeta(leader: StatisticsBasicLeader | null): string {
    if (!leader) {
      return 'Sin dato visible en el contrato.';
    }

    const parts = [leader.scope, leader.tieCount > 1 ? `Empate con ${leader.tieCount} equipos` : 'Sin empate visible']
      .filter((item) => Boolean(item));

    if (leader.status !== 'AVAILABLE') {
      parts.unshift(this.leaderStatusLabel(leader.status));
    }

    return parts.join(' · ') || 'Sin detalle adicional';
  }

  protected classificationSourceLabel(): string {
    const source = this.statistics()?.traceability.classificationSource;
    if (!source) {
      return 'No declarado';
    }

    const labels: Record<string, string> = {
      TOURNAMENT: 'Torneo',
      STAGE: 'Etapa',
      GROUP: 'Grupo',
      LEAGUE: 'League',
      GROUP_STAGE: 'Group stage',
      KNOCKOUT: 'Knockout'
    };

    return labels[source] ?? source;
  }

  protected stageName(stageId: number | null): string {
    if (!stageId) {
      return '';
    }

    return this.stages().find((stage) => stage.id === stageId)?.name ?? `Etapa ${stageId}`;
  }

  protected groupName(groupId: number | null): string {
    if (!groupId) {
      return '';
    }

    return this.groups().find((group) => group.id === groupId)?.name ?? `Grupo ${groupId}`;
  }

  protected formatDate(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    if (!parsed) {
      return 'Sin fecha';
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
    forkJoin({
      tournament: this.tournamentsService.getById(tournamentId),
      stages: this.catalogLoader.loadAll((page, size) => this.stagesService.list({ tournamentId, page, size })),
      groups: this.catalogLoader.loadAll((page, size) => this.groupsService.list({ page, size })),
      registrations: this.catalogLoader.loadAll((page, size) =>
        this.tournamentTeamsService.list({ tournamentId, page, size })
      ),
      teams: this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size }))
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const stageIds = new Set(result.stages.map((stage) => stage.id));
          this.tournament.set(result.tournament);
          this.stages.set(result.stages);
          this.groups.set(result.groups.filter((group) => stageIds.has(group.stageId)));
          this.tournamentTeams.set(result.registrations);
          this.teams.set(result.teams);
          this.filtersForm.patchValue({ stageId: '', groupId: '' }, { emitEvent: false });
          this.load();
        },
        error: (error: unknown) => {
          this.tournament.set(null);
          this.statistics.set(null);
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }

  private tournamentTeamLabel(tournamentTeamId: number): string {
    const registration = this.tournamentTeams().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `#${tournamentTeamId}`;
    }

    const team = this.teams().find((item) => item.id === registration.teamId);
    return team ? `${team.name} (#${registration.id})` : `Equipo ${registration.teamId} (#${registration.id})`;
  }

  private decimalLabel(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  private formatLabel(format: Tournament['format']): string {
    const labels: Record<Tournament['format'], string> = {
      LEAGUE: 'Liga',
      GROUPS_THEN_KNOCKOUT: 'Grupos + eliminacion',
      KNOCKOUT: 'Eliminacion'
    };

    return labels[format];
  }

  private statusTournamentLabel(status: Tournament['status']): string {
    const labels: Record<Tournament['status'], string> = {
      DRAFT: 'Borrador',
      OPEN: 'Abierto',
      IN_PROGRESS: 'En curso',
      FINISHED: 'Finalizado',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }
}
