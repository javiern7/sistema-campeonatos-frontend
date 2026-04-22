import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule } from '@angular/material/core';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { PICHANGA_DATE_PICKER_PROVIDERS, toBackendDate } from '../../shared/date/date-only.utils';
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
import { OperationalReport, ReportFormat, ReportType, ReportingFilters } from './reporting.models';
import { ReportingService } from './reporting.service';

type ReportOption = {
  type: ReportType;
  label: string;
  description: string;
  source: string;
};

type SummaryCard = {
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
};

const REPORT_OPTIONS: ReportOption[] = [
  { type: 'summary', label: 'Resumen de torneo', description: 'Totales operativos del torneo.', source: 'tournaments:read' },
  { type: 'matches', label: 'Partidos', description: 'Listado de partidos y resultados oficiales.', source: 'matches:read' },
  { type: 'standings', label: 'Tabla de posiciones', description: 'Lectura oficial existente, sin recalculo.', source: 'standings:read' },
  { type: 'events', label: 'Eventos', description: 'Eventos filtrables por partido, equipo, jugador o rango.', source: 'matches:read' },
  { type: 'scorers', label: 'Goleadores', description: 'Ranking simple desde eventos activos.', source: 'matches:read' },
  { type: 'cards', label: 'Tarjetas', description: 'Amarillas y rojas derivadas de eventos activos.', source: 'matches:read' }
];

@Component({
  selector: 'app-reporting-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  providers: PICHANGA_DATE_PICKER_PROVIDERS,
  template: `
    <section class="app-page">
      <app-page-header title="Reporteria y exportacion" [subtitle]="headerSubtitle()">
        <div class="header-actions">
          <a mat-stroked-button routerLink="/reporting">Cambiar torneo</a>
          <a mat-stroked-button [routerLink]="['/tournaments', tournamentId()]">Volver al torneo</a>
        </div>
      </app-page-header>

      @if (loadingContext()) {
        <app-loading-state label="Cargando contexto de reportes..." />
      } @else if (!tournament()) {
        <section class="card page-card app-page">
          <div class="empty-state">
            <strong>No se encontro el torneo solicitado.</strong>
            <p class="muted">Abre nuevamente la reporteria desde el hub operativo.</p>
          </div>
        </section>
      } @else {
        <section class="card page-card app-page">
          <div class="context-banner">
            <strong>{{ tournament()!.name }}</strong>
            <span class="muted">Reportes read-only desde contrato backend estable. No recalcula standings ni resultados.</span>
          </div>

          <form [formGroup]="filtersForm" class="filter-row">
            <mat-form-field appearance="outline">
              <mat-label>Reporte</mat-label>
              <mat-select formControlName="reportType">
                @for (option of reportOptions; track option.type) {
                  <mat-option [value]="option.type">{{ option.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

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

            <mat-form-field appearance="outline">
              <mat-label>Desde</mat-label>
              <input matInput [matDatepicker]="fromPicker" formControlName="from" placeholder="dd/mm/aaaa">
              <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
              <mat-datepicker #fromPicker />
              <mat-hint>dd/mm/aaaa</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Hasta</mat-label>
              <input matInput [matDatepicker]="toPicker" formControlName="to" placeholder="dd/mm/aaaa">
              <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
              <mat-datepicker #toPicker />
              <mat-hint>dd/mm/aaaa</mat-hint>
            </mat-form-field>
          </form>

          <div class="actions-row">
            <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
            <button mat-flat-button color="primary" type="button" (click)="loadReport()">Actualizar reporte</button>
          </div>

          @if (reportLoading()) {
            <app-loading-state label="Cargando reporte..." />
          } @else if (errorMessage()) {
            <div class="empty-state error-state">
              <strong>No se pudo cargar el reporte.</strong>
              <p class="muted">{{ errorMessage() }}</p>
            </div>
          } @else if (report()) {
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
              <strong>Trazabilidad</strong>
              <span class="muted">
                Fuente {{ sourceLabel() }}. Generado {{ generatedAtLabel() }}. Contrato {{ currentReport().source }}.
              </span>
            </div>
          }
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Reportes disponibles</h2>
              <p class="muted">Descargas simples cuando el backend lo soporte.</p>
            </div>
            <span class="muted">{{ currentScopeLabel() }}</span>
          </div>

          <div class="table-wrapper">
            <table class="detail-table">
              <thead>
                <tr>
                  <th>Reporte</th>
                  <th>Fuente</th>
                  <th>Alcance</th>
                  <th>Descarga</th>
                </tr>
              </thead>
              <tbody>
                @for (option of reportOptions; track option.type) {
                  <tr>
                    <td>
                      <strong>{{ option.label }}</strong>
                      <span class="muted table-note">{{ option.description }}</span>
                    </td>
                    <td>{{ option.source }}</td>
                    <td>{{ option.type === selectedReportType() ? 'Vista actual' : 'Disponible' }}</td>
                    <td>
                      <div class="download-actions">
                        @for (format of exportFormats; track format) {
                          <button
                            mat-stroked-button
                            type="button"
                            [disabled]="downloadKey() === option.type + '-' + format"
                            (click)="download(option.type, format)">
                            {{ formatLabel(format) }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (report()) {
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>{{ currentReport().label }}</h2>
                <p class="muted">Resumen descargable segun contrato backend.</p>
              </div>
            </div>

            @if (visibleRows().length === 0) {
              <div class="empty-state">
                <strong>Sin filas para este filtro.</strong>
                <p class="muted">El backend respondio correctamente, pero no hay registros para mostrar.</p>
              </div>
            } @else {
              <div class="table-wrapper">
                <table class="detail-table">
                  <thead>
                    <tr>
                      @for (column of visibleColumns(); track column) {
                        <th>{{ columnLabel(column) }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of visibleRows(); track rowIndex($index)) {
                      <tr>
                        @for (column of visibleColumns(); track column) {
                          <td>{{ valueLabel(row[column]) }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      .header-actions,
      .download-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .neutral-banner {
        margin-top: 0.5rem;
        background: linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(14, 116, 144, 0.02));
        border-color: rgba(14, 116, 144, 0.16);
      }

      .error-state {
        border-color: rgba(194, 65, 12, 0.45);
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

      .table-note {
        display: block;
        margin-top: 0.3rem;
      }

      @media (max-width: 720px) {
        .section-heading {
          flex-direction: column;
        }

        .download-actions button {
          width: 100%;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportingPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly reportingService = inject(ReportingService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly matchesService = inject(MatchesService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly teamsService = inject(TeamsService);
  private readonly playersService = inject(PlayersService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly reportOptions = REPORT_OPTIONS;
  protected readonly exportFormats: ReportFormat[] = ['csv', 'xlsx', 'pdf'];
  protected readonly loadingContext = signal(true);
  protected readonly reportLoading = signal(false);
  protected readonly tournamentId = signal(0);
  protected readonly tournament = signal<Tournament | null>(null);
  protected readonly matches = signal<MatchGame[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly players = signal<Player[]>([]);
  protected readonly report = signal<OperationalReport | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly downloadKey = signal('');
  protected readonly filtersForm = this.fb.nonNullable.group({
    reportType: ['summary' as ReportType],
    matchId: [0 as number | ''],
    tournamentTeamId: [0 as number | ''],
    playerId: [0 as number | ''],
    from: [null as Date | null],
    to: [null as Date | null]
  });
  protected readonly headerSubtitle = computed(() => {
    const tournament = this.tournament();
    return tournament ? `${tournament.name} - reportes operativos read-only` : 'Reportes simples y descargas por torneo.';
  });
  protected readonly visibleRows = computed(() => this.report()?.rows ?? []);
  protected readonly visibleColumns = computed(() => {
    const first = this.visibleRows()[0];
    return first ? Object.keys(first).slice(0, 8) : [];
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const report = this.report();
    if (!report) {
      return [];
    }

    return [
      { label: 'Reporte', value: this.currentReport().label, meta: this.selectedReportType(), accent: true },
      { label: 'Filas', value: String(report.rows.length), meta: 'Registros recibidos' },
      { label: 'Totales', value: String(Object.keys(report.totals ?? {}).length), meta: 'Campos de totales' },
      { label: 'Filtros', value: String(Object.keys(report.filters ?? {}).length), meta: 'Criterios aplicados' }
    ];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.tournamentId.set(Number(params.get('id')));
      this.loadContext();
    });
  }

  protected loadReport(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      return;
    }

    this.reportLoading.set(true);
    this.errorMessage.set('');
    const values = this.filtersForm.getRawValue();
    this.reportingService
      .getReport(tournamentId, values.reportType, this.cleanFilters(values))
      .pipe(finalize(() => this.reportLoading.set(false)))
      .subscribe({
        next: (report) => this.report.set(report),
        error: (error: unknown) => {
          const mapped = this.errorMapper.map(error);
          this.report.set(null);
          this.errorMessage.set(mapped.message);
          this.notifications.error(mapped.message);
        }
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ reportType: 'summary', matchId: '', tournamentTeamId: '', playerId: '', from: null, to: null });
    this.loadReport();
  }

  protected download(reportType: ReportType, format: ReportFormat): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      return;
    }

    this.downloadKey.set(`${reportType}-${format}`);
    this.reportingService
      .exportReport(tournamentId, reportType, format, this.cleanFilters(this.filtersForm.getRawValue()))
      .pipe(finalize(() => this.downloadKey.set('')))
      .subscribe({
        next: (file) => {
          const url = URL.createObjectURL(new Blob([file.blob], { type: file.contentType }));
          const link = document.createElement('a');
          link.href = url;
          link.download = file.fileName;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected currentScopeLabel(): string {
    const filters = this.cleanFilters(this.filtersForm.getRawValue());
    const labels = [
      filters.matchId ? `Partido #${filters.matchId}` : '',
      filters.tournamentTeamId ? this.tournamentTeamLabel(filters.tournamentTeamId) : '',
      filters.playerId ? this.playerName(filters.playerId) : '',
      filters.from ? `Desde ${filters.from}` : '',
      filters.to ? `Hasta ${filters.to}` : ''
    ].filter(Boolean);

    return labels.length > 0 ? labels.join(' / ') : 'Torneo completo';
  }

  protected matchLabel(match: MatchGame): string {
    return `#${match.id} - ${this.tournamentTeamLabel(match.homeTournamentTeamId)} vs ${this.tournamentTeamLabel(match.awayTournamentTeamId)}`;
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

  protected sourceLabel(): string {
    return this.report()?.metadata?.source || 'backend reports';
  }

  protected generatedAtLabel(): string {
    const parsed = parseBackendDateTime(this.report()?.metadata?.generatedAt ?? null);
    if (!parsed) {
      return 'sin fecha declarada';
    }

    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  }

  protected formatLabel(format: ReportFormat): string {
    return format.toUpperCase();
  }

  protected columnLabel(column: string): string {
    return column.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
  }

  protected valueLabel(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'Si' : 'No';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  protected rowIndex(index: number): number {
    return index;
  }

  protected selectedReportType(): ReportType {
    return this.filtersForm.getRawValue().reportType;
  }

  protected currentReport(): ReportOption {
    return this.reportOptions.find((item) => item.type === this.selectedReportType()) ?? this.reportOptions[0];
  }

  private loadContext(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      this.loadingContext.set(false);
      this.tournament.set(null);
      return;
    }

    this.loadingContext.set(true);
    this.errorMessage.set('');
    forkJoin({
      tournament: this.tournamentsService.getById(tournamentId),
      matches: this.catalogLoader.loadAll((page, size) => this.matchesService.list({ tournamentId, page, size })),
      registrations: this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ tournamentId, page, size })),
      teams: this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })),
      players: this.catalogLoader.loadAll((page, size) => this.playersService.list({ page, size }))
    }).subscribe({
      next: (result) => {
        this.tournament.set(result.tournament);
        this.matches.set(result.matches);
        this.tournamentTeams.set(result.registrations);
        this.teams.set(result.teams);
        this.players.set(result.players);
        this.loadingContext.set(false);
        this.loadReport();
      },
      error: (error: unknown) => {
        const mapped = this.errorMapper.map(error);
        this.loadingContext.set(false);
        this.tournament.set(null);
        this.report.set(null);
        this.errorMessage.set(mapped.message);
        this.notifications.error(mapped.message);
      }
    });
  }

  private cleanFilters(values: {
    matchId: number | '';
    tournamentTeamId: number | '';
    playerId: number | '';
    from: Date | null;
    to: Date | null;
  }): ReportingFilters {
    return {
      matchId: values.matchId,
      tournamentTeamId: values.tournamentTeamId,
      playerId: values.playerId,
      from: toBackendDate(values.from) ?? '',
      to: toBackendDate(values.to) ?? ''
    };
  }
}
