import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

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
import { MatchGame, MatchPage, MatchStatus } from './match.models';
import { MatchesService } from './matches.service';

type SummaryCard = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

@Component({
  selector: 'app-match-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Partidos" subtitle="Gestion operativa del fixture y sus resultados.">
        @if (canManage()) {
          <a mat-flat-button color="primary" routerLink="/matches/new">Nuevo partido</a>
        }
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Torneo</mat-label>
            <mat-select formControlName="tournamentId">
              <mat-option value="">Todos</mat-option>
              @for (item of tournaments(); track item.id) {
                <mat-option [value]="item.id">{{ item.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Etapa</mat-label>
            <mat-select formControlName="stageId">
              <mat-option value="">Todas</mat-option>
              @for (item of stages(); track item.id) {
                <mat-option [value]="item.id">{{ item.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Grupo</mat-label>
            <mat-select formControlName="groupId">
              <mat-option value="">Todos</mat-option>
              @for (item of groups(); track item.id) {
                <mat-option [value]="item.id">{{ item.name }}</mat-option>
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
        </form>

        <div class="actions-row">
          <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
          <button mat-flat-button color="primary" type="button" (click)="load()">Buscar</button>
        </div>

        @if (loading()) {
          <app-loading-state />
        } @else {
          <div class="context-banner">
            <strong>{{ selectedContextLabel() }}</strong>
            <span class="muted">Total filtrado: {{ page()?.totalElements ?? 0 }} partidos</span>
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

          @if (rows().length === 0) {
            <div class="empty-state">
              <strong>No hay partidos para este filtro.</strong>
              <p class="muted">Prueba otro contexto o registra un nuevo partido para comenzar a operar el fixture.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="rows()" class="w-100">
                <ng-container matColumnDef="fixture">
                  <th mat-header-cell *matHeaderCellDef>Fixture</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <strong>{{ tournamentTeamLabel(row.homeTournamentTeamId) }} vs {{ tournamentTeamLabel(row.awayTournamentTeamId) }}</strong>
                      <span class="muted">Partido #{{ row.id }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="context">
                  <th mat-header-cell *matHeaderCellDef>Contexto</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <span>{{ tournamentName(row.tournamentId) }}</span>
                      <span class="muted">{{ row.stageId ? stageName(row.stageId) : 'Sin etapa' }} / {{ row.groupId ? groupName(row.groupId) : 'Sin grupo' }}</span>
                      <span class="muted">{{ roundLabel(row) }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="schedule">
                  <th mat-header-cell *matHeaderCellDef>Programacion</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <span>{{ formatDate(row.scheduledAt) }}</span>
                      <span class="muted">{{ row.venueName || 'Sede por definir' }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="score">
                  <th mat-header-cell *matHeaderCellDef>Resultado</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <strong>{{ scoreLabel(row) }}</strong>
                      <span class="muted">{{ winnerLabel(row) }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Estado</th>
                  <td mat-cell *matCellDef="let row">
                    <span [class]="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let row">
                    @if (canManage()) {
                      <a mat-button [routerLink]="['/matches', row.id, 'edit']">Editar</a>
                    }
                    @if (canDelete()) {
                      <button mat-button type="button" color="warn" (click)="remove(row)">Eliminar</button>
                    }
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
              </table>
            </div>
          }

          <mat-paginator
            [length]="page()?.totalElements ?? 0"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [pageSizeOptions]="pageSizeOptions"
            (page)="changePage($event)"
          />
        }
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly matchesService = inject(MatchesService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);
  private readonly selectedTournamentId = signal(0);
  private readonly selectedStageId = signal(0);
  private readonly selectedStatus = signal<MatchStatus | ''>('');

  protected readonly loading = signal(true);
  protected readonly page = signal<MatchPage | null>(null);
  protected readonly rows = signal<MatchGame[]>([]);
  protected readonly tournaments = signal<Tournament[]>([]);
  private readonly allStages = signal<TournamentStage[]>([]);
  private readonly allGroups = signal<StageGroup[]>([]);
  private readonly teams = signal<Team[]>([]);
  private readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly statuses: MatchStatus[] = ['SCHEDULED', 'PLAYED', 'FORFEIT', 'CANCELLED'];
  protected readonly canManage = computed(() => this.authorization.canManage('matches'));
  protected readonly canDelete = computed(() => this.authorization.canDelete('matches'));
  protected readonly stages = computed(() => {
    const tournamentId = this.selectedTournamentId();
    return tournamentId ? this.allStages().filter((item) => item.tournamentId === tournamentId) : this.allStages();
  });
  protected readonly groups = computed(() => {
    const stageId = this.selectedStageId();
    return stageId ? this.allGroups().filter((item) => item.stageId === stageId) : [];
  });
  protected readonly selectedContextLabel = computed(() => {
    const labels = [
      this.tournamentName(this.selectedTournamentId()),
      this.stageName(this.selectedStageId()),
      this.groupName(Number(this.filtersForm.controls.groupId.getRawValue())),
      this.statusLabel(this.selectedStatus())
    ].filter((label) => Boolean(label));

    return labels.length > 0 ? labels.join(' / ') : 'Todos los torneos y estados';
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const matches = this.rows();
    const played = matches.filter((item) => item.status === 'PLAYED').length;
    const pending = matches.filter((item) => item.status === 'SCHEDULED').length;
    const unresolved = matches.filter((item) => item.status === 'FORFEIT' || item.status === 'CANCELLED').length;

    return [
      {
        label: 'Contexto activo',
        value: this.page()?.totalElements ?? 0,
        meta: this.selectedContextLabel(),
        accent: true
      },
      {
        label: 'Jugados en pagina',
        value: played,
        meta: 'Resultados cerrados visibles'
      },
      {
        label: 'Pendientes en pagina',
        value: pending,
        meta: 'Programados por disputar'
      },
      {
        label: 'Con novedad',
        value: unresolved,
        meta: 'Forfeit o cancelados'
      }
    ];
  });
  protected readonly displayedColumns = computed(() => {
    const columns = ['fixture', 'context', 'schedule', 'score', 'status'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [''],
    stageId: [''],
    groupId: [''],
    status: ['' as MatchStatus | '']
  });

  constructor() {
    this.catalogLoader
      .loadAll((page, size) => this.tournamentsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournaments.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.stagesService.list({ page, size }))
      .subscribe({ next: (items) => this.allStages.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.groupsService.list({ page, size }))
      .subscribe({ next: (items) => this.allGroups.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.teamsService.list({ page, size }))
      .subscribe({ next: (items) => this.teams.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.tournamentTeamsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournamentTeams.set(items) });

    this.filtersForm.controls.tournamentId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const tournamentId = Number(value);
      this.selectedTournamentId.set(tournamentId);
      const validStageIds = new Set(this.allStages().filter((item) => item.tournamentId === tournamentId).map((item) => item.id));
      const currentStageId = Number(this.filtersForm.controls.stageId.getRawValue());

      this.filtersForm.patchValue(
        {
          stageId: currentStageId && validStageIds.has(currentStageId) ? String(currentStageId) : '',
          groupId: ''
        },
        { emitEvent: false }
      );
    });

    this.filtersForm.controls.stageId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const stageId = Number(value);
      this.selectedStageId.set(stageId);
      const validGroupIds = new Set(this.allGroups().filter((item) => item.stageId === stageId).map((item) => item.id));
      const currentGroupId = Number(this.filtersForm.controls.groupId.getRawValue());

      if (currentGroupId && !validGroupIds.has(currentGroupId)) {
        this.filtersForm.patchValue({ groupId: '' }, { emitEvent: false });
      }
    });

    this.filtersForm.controls.status.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.selectedStatus.set(value);
    });

    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    this.matchesService
      .list({
        tournamentId: filters.tournamentId ? Number(filters.tournamentId) : '',
        stageId: filters.stageId ? Number(filters.stageId) : '',
        groupId: filters.groupId ? Number(filters.groupId) : '',
        status: filters.status,
        page: this.pageIndex(),
        size: this.pageSize()
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.rows.set(page.content);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ tournamentId: '', stageId: '', groupId: '', status: '' });
    this.pageIndex.set(0);
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected remove(row: MatchGame): void {
    if (!window.confirm(`Se eliminara el partido #${row.id}. Esta accion no se puede deshacer.`)) {
      return;
    }

    this.loading.set(true);
    this.matchesService
      .delete(row.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Partido eliminado correctamente');
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected tournamentTeamLabel(tournamentTeamId: number): string {
    const registration = this.tournamentTeams().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `#${tournamentTeamId}`;
    }

    const team = this.teams().find((item) => item.id === registration.teamId);
    return team ? `${team.name} (#${registration.id})` : `Equipo ${registration.teamId} (#${registration.id})`;
  }

  protected tournamentName(id: number): string {
    if (!id) {
      return '';
    }

    return this.tournaments().find((item) => item.id === id)?.name ?? `Torneo ${id}`;
  }

  protected stageName(id: number): string {
    if (!id) {
      return '';
    }

    return this.allStages().find((item) => item.id === id)?.name ?? `Etapa ${id}`;
  }

  protected groupName(id: number): string {
    if (!id) {
      return '';
    }

    return this.allGroups().find((item) => item.id === id)?.name ?? `Grupo ${id}`;
  }

  protected roundLabel(row: MatchGame): string {
    const parts = [];
    if (row.roundNumber) {
      parts.push(`Ronda ${row.roundNumber}`);
    }
    if (row.matchdayNumber) {
      parts.push(`Fecha ${row.matchdayNumber}`);
    }

    return parts.length > 0 ? parts.join(' / ') : 'Sin ronda ni fecha';
  }

  protected formatDate(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    if (!parsed) {
      return 'Sin programacion';
    }

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(parsed);
  }

  protected scoreLabel(row: MatchGame): string {
    if (row.homeScore === null || row.awayScore === null) {
      return 'Pendiente';
    }

    return `${row.homeScore} - ${row.awayScore}`;
  }

  protected winnerLabel(row: MatchGame): string {
    if (!row.winnerTournamentTeamId) {
      return row.status === 'PLAYED' ? 'Sin ganador cargado' : 'Ganador pendiente';
    }

    return `Ganador: ${this.tournamentTeamLabel(row.winnerTournamentTeamId)}`;
  }

  protected statusLabel(status: MatchStatus | ''): string {
    const labels: Record<MatchStatus, string> = {
      SCHEDULED: 'Programado',
      PLAYED: 'Jugado',
      FORFEIT: 'Forfeit',
      CANCELLED: 'Cancelado'
    };

    return status ? labels[status] : '';
  }

  protected statusClass(status: MatchStatus): string {
    return `status-pill ${status.toLowerCase()}`;
  }
}
