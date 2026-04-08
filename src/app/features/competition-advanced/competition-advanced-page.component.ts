import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AuthorizationService } from '../../core/auth/authorization.service';
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
import { MatchStatus } from '../matches/match.models';
import {
  CompetitionAdvancedBracketResponse,
  CompetitionAdvancedCalendarResponse,
  CompetitionAdvancedMatch,
  CompetitionAdvancedResultsResponse
} from './competition-advanced.models';
import { CompetitionAdvancedService } from './competition-advanced.service';

type SummaryCard = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

type GenerationAction = 'progress' | 'generate';

@Component({
  selector: 'app-competition-advanced-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Competencia avanzada" [subtitle]="headerSubtitle()">
        <div class="header-actions">
          <a mat-stroked-button [routerLink]="['/tournaments', tournamentId()]">Volver al torneo</a>
          <a
            mat-stroked-button
            routerLink="/standings"
            [queryParams]="{ tournamentId: tournamentId(), stageId: selectedKnockoutStageId() || null }"
          >
            Ver standings
          </a>
        </div>
      </app-page-header>

      @if (loading()) {
        <app-loading-state label="Cargando lectura competitiva..." />
      } @else if (!tournament()) {
        <section class="card page-card app-page">
          <div class="empty-state">
            <strong>No se encontro el torneo solicitado.</strong>
            <p class="muted">Verifica el contexto y vuelve a abrir la lectura desde el detalle del torneo.</p>
          </div>
        </section>
      } @else {
        <section class="card page-card app-page">
          <div class="context-banner">
            <strong>{{ tournament()!.name }}</strong>
            <span class="muted">
              Llaves, calendario, generacion inicial y resultados sin abrir semanticas paralelas ni navegacion global nueva.
            </span>
          </div>

          <form [formGroup]="filtersForm" class="filter-row">
            <mat-form-field appearance="outline">
              <mat-label>Etapa knockout</mat-label>
              <mat-select formControlName="stageId">
                <mat-option value="">Todas</mat-option>
                @for (stage of knockoutStages(); track stage.id) {
                  <mat-option [value]="stage.id">{{ stage.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Grupo</mat-label>
              <mat-select formControlName="groupId">
                <mat-option value="">Todos</mat-option>
                @for (group of filteredGroups(); track group.id) {
                  <mat-option [value]="group.id">{{ group.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">Todos</mat-option>
                @for (status of statuses; track status) {
                  <mat-option [value]="status">{{ statusLabel(status) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Desde</mat-label>
              <input matInput type="date" formControlName="from">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Hasta</mat-label>
              <input matInput type="date" formControlName="to">
            </mat-form-field>
          </form>

          <div class="actions-row">
            <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
            <button mat-flat-button color="primary" type="button" (click)="load()">Actualizar lectura</button>
            @if (canProgressToKnockout() || canGenerateKnockoutBracket()) {
              @if (canProgressToKnockout()) {
              <button
                mat-stroked-button
                type="button"
                [disabled]="runningAction() === 'progress'"
                (click)="runGeneration('progress')"
              >
                {{ runningAction() === 'progress' ? 'Progresando...' : 'Progress to knockout' }}
              </button>
              }
              @if (canGenerateKnockoutBracket()) {
              <button
                mat-flat-button
                color="accent"
                type="button"
                [disabled]="runningAction() === 'generate'"
                (click)="runGeneration('generate')"
              >
                {{ runningAction() === 'generate' ? 'Generando...' : 'Generar llave inicial' }}
              </button>
              }
            }
          </div>

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
              Results es lectura de partidos cerrados; standings solo se invoca donde el contrato lo declara aplicable.
            </span>
          </div>
        </section>

        <section class="content-grid">
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Brackets / llaves</h2>
                <p class="muted">Lectura por ronda de la etapa knockout sin persistencia ni arbol paralelo.</p>
              </div>
              <span class="muted">{{ bracketStageLabel() }}</span>
            </div>

            @if (!bracket() || bracket()!.rounds.length === 0) {
              <div class="empty-state">
                <strong>No hay llaves visibles para este contexto.</strong>
                <p class="muted">Confirma que exista etapa knockout activa y que el torneo ya tenga cruces generados.</p>
              </div>
            } @else {
              <div class="rounds-grid">
                @for (round of bracket()!.rounds; track round.roundNumber) {
                  <article class="round-card">
                    <div class="section-heading compact">
                      <strong>Ronda {{ round.roundNumber }}</strong>
                      <span class="muted">{{ round.matches.length }} partido(s)</span>
                    </div>

                    <div class="list-stack">
                      @for (match of round.matches; track match.id) {
                        <article class="list-card">
                          <div class="list-row">
                            <strong>{{ teamLabel(match, 'home') }} vs {{ teamLabel(match, 'away') }}</strong>
                            <span [class]="statusClass(match.status)">{{ statusLabel(match.status) }}</span>
                          </div>
                          <div class="list-meta">
                            <span>{{ matchProgrammingLabel(match) }}</span>
                            <span>{{ scoreLabel(match) }}</span>
                          </div>
                          <span class="muted">{{ winnerLabel(match) }}</span>
                        </article>
                      }
                    </div>
                  </article>
                }
              </div>
            }
          </section>

          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Calendario</h2>
                <p class="muted">Programacion operativa filtrable por etapa, grupo, estado y ventana temporal.</p>
              </div>
              <a mat-button routerLink="/matches" [queryParams]="calendarQueryParams()">Abrir partidos</a>
            </div>

            @if (!calendar() || calendar()!.matches.length === 0) {
              <div class="empty-state">
                <strong>No hay partidos en el calendario filtrado.</strong>
                <p class="muted">Ajusta filtros o genera cruces si el torneo ya esta listo para knockout.</p>
              </div>
            } @else {
              <div class="list-stack">
                @for (match of calendar()!.matches; track match.id) {
                  <article class="list-card">
                    <div class="list-row">
                      <strong>{{ teamLabel(match, 'home') }} vs {{ teamLabel(match, 'away') }}</strong>
                      <span [class]="statusClass(match.status)">{{ statusLabel(match.status) }}</span>
                    </div>
                    <div class="list-meta">
                      <span>{{ formatDate(match.scheduledAt) }}</span>
                      <span>{{ matchContextLabel(match) }}</span>
                    </div>
                    <span class="muted">{{ match.venueName || 'Sede por definir' }}</span>
                  </article>
                }
              </div>
            }
          </section>

          <section class="card page-card app-page results-column">
            <div class="section-heading">
              <div>
                <h2>Resultados</h2>
                <p class="muted">Lectura cerrada de partidos jugados o resueltos, con amarre explicito hacia standings.</p>
              </div>
              <span class="muted">{{ resultsSummaryLabel() }}</span>
            </div>

            @if (!results() || results()!.matches.length === 0) {
              <div class="empty-state">
                <strong>No hay resultados cerrados para este filtro.</strong>
                <p class="muted">Cuando existan partidos jugados o resueltos por forfeit, apareceran aqui con su impacto competitivo.</p>
              </div>
            } @else {
              <div class="list-stack">
                @for (match of results()!.matches; track match.id) {
                  <article class="list-card">
                    <div class="list-row">
                      <strong>{{ teamLabel(match, 'home') }} vs {{ teamLabel(match, 'away') }}</strong>
                      <span [class]="statusClass(match.status)">{{ statusLabel(match.status) }}</span>
                    </div>
                    <div class="list-meta">
                      <span>{{ scoreLabel(match) }}</span>
                      <span>{{ winnerLabel(match) }}</span>
                    </div>
                    <div class="result-footer">
                      <span class="muted">{{ standingsImpactLabel(match) }}</span>
                      @if (match.affectsStandings) {
                        <a mat-button routerLink="/standings" [queryParams]="standingsQueryParams(match)">Ver standings</a>
                      }
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
      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .content-grid {
        display: grid;
        gap: 1rem;
      }

      .section-heading,
      .list-row,
      .result-footer {
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

      .rounds-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .round-card {
        display: grid;
        gap: 0.9rem;
        padding: 1rem;
        border-radius: 16px;
        background: var(--surface-alt);
      }

      .list-stack {
        display: grid;
        gap: 0.85rem;
      }

      .list-card {
        display: grid;
        gap: 0.45rem;
        padding: 1rem;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.18);
      }

      .list-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        color: var(--text-soft);
        font-size: 0.92rem;
      }

      .results-column {
        margin-bottom: 2rem;
      }

      @media (max-width: 720px) {
        .section-heading,
        .list-row,
        .result-footer {
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompetitionAdvancedPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly competitionAdvancedService = inject(CompetitionAdvancedService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly teamsService = inject(TeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly tournament = signal<Tournament | null>(null);
  protected readonly stages = signal<TournamentStage[]>([]);
  protected readonly groups = signal<StageGroup[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly bracket = signal<CompetitionAdvancedBracketResponse | null>(null);
  protected readonly calendar = signal<CompetitionAdvancedCalendarResponse | null>(null);
  protected readonly results = signal<CompetitionAdvancedResultsResponse | null>(null);
  protected readonly runningAction = signal<GenerationAction | null>(null);
  protected readonly tournamentId = signal(0);
  protected readonly statuses: MatchStatus[] = ['SCHEDULED', 'PLAYED', 'FORFEIT', 'CANCELLED'];
  protected readonly knockoutStages = computed(() => this.stages().filter((stage) => stage.stageType === 'KNOCKOUT'));
  protected readonly selectedKnockoutStageId = computed(() => Number(this.filtersForm.controls.stageId.getRawValue() || 0));
  protected readonly filteredGroups = computed(() => {
    const stageId = this.selectedKnockoutStageId();
    return stageId ? this.groups().filter((group) => group.stageId === stageId) : [];
  });
  protected readonly headerSubtitle = computed(() => {
    const tournament = this.tournament();
    if (!tournament) {
      return 'Lectura de llaves, calendario, generacion inicial y resultados para el torneo seleccionado.';
    }

    return `${tournament.name} · ${this.formatLabel(tournament.format)} · ${this.statusTournamentLabel(tournament.status)}`;
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const bracket = this.bracket();
    const calendar = this.calendar();
    const results = this.results();

    return [
      {
        label: 'Llaves visibles',
        value: bracket?.totalMatches ?? 0,
        meta: bracket?.stageName ? `Etapa: ${bracket.stageName}` : 'Sin llave activa visible',
        accent: true
      },
      {
        label: 'Calendario total',
        value: calendar?.totalMatches ?? 0,
        meta: calendar ? `${calendar.scheduledMatches} programados / ${calendar.closedMatches} cerrados` : 'Sin calendario visible'
      },
      {
        label: 'Resultados cerrados',
        value: results?.matches.length ?? 0,
        meta: this.resultsSummaryLabel()
      }
    ];
  });
  protected readonly canProgressToKnockout = computed(() => this.authorization.canProgressTournamentToKnockout());
  protected readonly canGenerateKnockoutBracket = computed(() =>
    this.authorization.canGenerateTournamentKnockoutBracket()
  );
  protected readonly filtersForm = this.fb.nonNullable.group({
    stageId: [0 as number | ''],
    groupId: [0 as number | ''],
    status: ['' as MatchStatus | ''],
    from: [''],
    to: ['']
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

    const filters = this.filtersForm.getRawValue();
    this.loading.set(true);
    forkJoin({
      bracket: this.competitionAdvancedService.getBracket(tournamentId, filters.stageId),
      calendar: this.competitionAdvancedService.getCalendar(tournamentId, {
        stageId: filters.stageId,
        groupId: filters.groupId,
        status: filters.status,
        from: filters.from,
        to: filters.to
      }),
      results: this.competitionAdvancedService.getResults(tournamentId, {
        stageId: filters.stageId,
        groupId: filters.groupId
      })
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.bracket.set(result.bracket);
          this.calendar.set(result.calendar);
          this.results.set({
            ...result.results,
            matches: result.results.matches.filter((match) => match.status === 'PLAYED' || match.status === 'FORFEIT')
          });
        },
        error: (error: unknown) => {
          this.notifications.error(this.errorMapper.map(error).message);
          this.bracket.set(null);
          this.calendar.set(null);
          this.results.set(null);
        }
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ stageId: '', groupId: '', status: '', from: '', to: '' });
    this.load();
  }

  protected runGeneration(action: GenerationAction): void {
    const tournament = this.tournament();
    if (!tournament) {
      return;
    }

    this.runningAction.set(action);
    const request =
      action === 'progress'
        ? this.competitionAdvancedService.progressToKnockout(tournament.id)
        : this.competitionAdvancedService.generateKnockoutBracket(tournament.id);

    request
      .pipe(finalize(() => this.runningAction.set(null)))
      .subscribe({
        next: () => {
          this.notifications.success(
            action === 'progress'
              ? 'Se ejecuto progress-to-knockout y se refresco la lectura.'
              : 'Se genero la llave inicial y se refresco la lectura.'
          );
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected statusLabel(status: MatchStatus): string {
    const labels: Record<MatchStatus, string> = {
      SCHEDULED: 'Programado',
      PLAYED: 'Jugado',
      FORFEIT: 'Forfeit',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  protected statusClass(status: MatchStatus): string {
    return `status-pill ${status.toLowerCase()}`;
  }

  protected bracketStageLabel(): string {
    const bracket = this.bracket();
    if (!bracket?.stageName) {
      return 'Sin etapa knockout visible';
    }

    return `${bracket.stageName} · ${bracket.totalMatches} cruce(s)`;
  }

  protected resultsSummaryLabel(): string {
    const results = this.results();
    if (!results) {
      return 'Sin resultados cargados';
    }

    const withStandingsImpact = results.matches.filter((match) => match.affectsStandings).length;
    return `${results.matches.length} cierre(s), ${withStandingsImpact} con impacto en tabla`;
  }

  protected teamLabel(match: CompetitionAdvancedMatch, side: 'home' | 'away'): string {
    const participant = side === 'home' ? match.homeTeam : match.awayTeam;
    const nestedLabel = participant?.label || participant?.teamName;
    if (nestedLabel) {
      return nestedLabel;
    }

    const tournamentTeamId =
      side === 'home'
        ? participant?.tournamentTeamId ?? match.homeTournamentTeamId ?? null
        : participant?.tournamentTeamId ?? match.awayTournamentTeamId ?? null;

    return this.tournamentTeamLabel(tournamentTeamId);
  }

  protected winnerLabel(match: CompetitionAdvancedMatch): string {
    if (!match.winnerTournamentTeamId && !match.winnerTeam?.label && !match.winnerTeam?.teamName) {
      return match.status === 'PLAYED' ? 'Sin ganador visible en contrato' : 'Ganador pendiente';
    }

    if (match.winnerTeam?.label || match.winnerTeam?.teamName) {
      return `Ganador: ${match.winnerTeam.label ?? match.winnerTeam.teamName}`;
    }

    return `Ganador: ${this.tournamentTeamLabel(match.winnerTournamentTeamId ?? null)}`;
  }

  protected scoreLabel(match: CompetitionAdvancedMatch): string {
    if (match.homeScore === null || match.awayScore === null) {
      return 'Marcador pendiente';
    }

    return `${match.homeScore} - ${match.awayScore}`;
  }

  protected matchProgrammingLabel(match: CompetitionAdvancedMatch): string {
    const parts = [];
    if (match.roundNumber) {
      parts.push(`Ronda ${match.roundNumber}`);
    }
    if (match.matchdayNumber) {
      parts.push(`Fecha ${match.matchdayNumber}`);
    }
    if (match.scheduledAt) {
      parts.push(this.formatDate(match.scheduledAt));
    }

    return parts.join(' / ') || 'Sin programacion visible';
  }

  protected matchContextLabel(match: CompetitionAdvancedMatch): string {
    return [this.stageName(match.stageId), this.groupName(match.groupId), this.matchProgrammingLabel(match)]
      .filter((item) => Boolean(item))
      .join(' / ');
  }

  protected standingsImpactLabel(match: CompetitionAdvancedMatch): string {
    if (!match.affectsStandings) {
      return 'No afecta standings; la lectura queda cerrada sobre resultados o knockout.';
    }

    const parts = ['Impacta standings', match.standingScope, match.standingStatus].filter((item) => Boolean(item));
    return parts.join(' · ');
  }

  protected standingsQueryParams(match: CompetitionAdvancedMatch): Record<string, number | null> {
    return {
      tournamentId: this.tournamentId(),
      stageId: match.stageId ?? null,
      groupId: match.groupId ?? null
    };
  }

  protected calendarQueryParams(): Record<string, string | number | null> {
    const filters = this.filtersForm.getRawValue();
    return {
      tournamentId: this.tournamentId(),
      stageId: filters.stageId || null,
      groupId: filters.groupId || null,
      status: filters.status || null
    };
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

          const firstKnockoutStage = result.stages.find((stage) => stage.stageType === 'KNOCKOUT');
          this.filtersForm.patchValue(
            {
              stageId: firstKnockoutStage?.id ?? '',
              groupId: '',
              status: '',
              from: '',
              to: ''
            },
            { emitEvent: false }
          );

          this.load();
        },
        error: (error: unknown) => {
          this.tournament.set(null);
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }

  private tournamentTeamLabel(tournamentTeamId: number | null): string {
    if (!tournamentTeamId) {
      return 'Equipo por definir';
    }

    const registration = this.tournamentTeams().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `#${tournamentTeamId}`;
    }

    const team = this.teams().find((item) => item.id === registration.teamId);
    return team ? `${team.name} (#${registration.id})` : `Equipo ${registration.teamId} (#${registration.id})`;
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
