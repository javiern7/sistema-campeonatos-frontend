import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
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
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { MatchGame } from '../matches/match.models';
import { MatchesService } from '../matches/matches.service';
import { RosterEntry } from '../rosters/roster.models';
import { RostersService } from '../rosters/rosters.service';
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
import { Standing, StandingPage, StandingRecalculationResponse } from './standings.models';
import { StandingsService } from './standings.service';

type SummaryCard = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

@Component({
  selector: 'app-standings-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
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
      <app-page-header title="Tabla de posiciones" subtitle="Seguimiento competitivo y recalculo por contexto.">
        @if (canManage()) {
          <button
            mat-flat-button
            color="primary"
            type="button"
            (click)="recalculate()"
            [disabled]="recalculating() || !filtersForm.controls.tournamentId.getRawValue()"
          >
            {{ recalculating() ? 'Recalculando...' : 'Recalcular standings' }}
          </button>
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
              @for (item of filteredStages(); track item.id) {
                <mat-option [value]="item.id">{{ item.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Grupo</mat-label>
            <mat-select formControlName="groupId">
              <mat-option value="">Todos</mat-option>
              @for (item of filteredGroups(); track item.id) {
                <mat-option [value]="item.id">{{ item.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Inscripcion</mat-label>
            <mat-select formControlName="tournamentTeamId">
              <mat-option value="">Todos</mat-option>
              @for (item of filteredTournamentTeams(); track item.id) {
                <mat-option [value]="item.id">{{ tournamentTeamLabel(item.id) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </form>

        <div class="actions-row">
          <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
          <button mat-flat-button color="primary" type="button" (click)="load()">Buscar</button>
        </div>

        @if (standingsAuditMessage()) {
          <div class="context-banner">
            <strong>Auditoria Sprint 6</strong>
            <span class="muted">{{ standingsAuditMessage() }}</span>
          </div>
        }

        @if (message()) {
          <p class="muted">{{ message() }}</p>
        }

        @if (loading()) {
          <app-loading-state />
        } @else {
          <div class="context-banner">
            <strong>{{ selectedContextLabel() }}</strong>
            <span class="muted">Total filtrado: {{ page()?.totalElements ?? 0 }} registros de tabla</span>
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
              <strong>No hay standings para este contexto.</strong>
              <p class="muted">Aplica filtros, recalcula la tabla o valida que ya existan partidos jugados en ese alcance.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="rows()" class="w-100">
                <ng-container matColumnDef="rank">
                  <th mat-header-cell *matHeaderCellDef>Pos.</th>
                  <td mat-cell *matCellDef="let row">{{ row.rankPosition ?? '-' }}</td>
                </ng-container>
                <ng-container matColumnDef="team">
                  <th mat-header-cell *matHeaderCellDef>Equipo</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <strong>{{ tournamentTeamLabel(row.tournamentTeamId) }}</strong>
                      <span class="muted">{{ standingContext(row) }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="record">
                  <th mat-header-cell *matHeaderCellDef>Balance</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <span>PJ {{ row.played }} / G {{ row.wins }} / E {{ row.draws }} / P {{ row.losses }}</span>
                      <span class="muted">Dif. {{ row.scoreDiff }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="scoring">
                  <th mat-header-cell *matHeaderCellDef>Anotacion</th>
                  <td mat-cell *matCellDef="let row">{{ row.pointsFor }} a favor / {{ row.pointsAgainst }} en contra</td>
                </ng-container>
                <ng-container matColumnDef="points">
                  <th mat-header-cell *matHeaderCellDef>Pts</th>
                  <td mat-cell *matCellDef="let row">{{ row.points }}</td>
                </ng-container>
                <ng-container matColumnDef="updatedAt">
                  <th mat-header-cell *matHeaderCellDef>Actualizado</th>
                  <td mat-cell *matCellDef="let row">{{ formatDate(row.updatedAt) }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
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
export class StandingsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly standingsService = inject(StandingsService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly rostersService = inject(RostersService);
  private readonly matchesService = inject(MatchesService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(false);
  protected readonly recalculating = signal(false);
  protected readonly rows = signal<Standing[]>([]);
  protected readonly page = signal<StandingPage | null>(null);
  protected readonly message = signal('');
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly stages = signal<TournamentStage[]>([]);
  protected readonly groups = signal<StageGroup[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly allRosters = signal<RosterEntry[]>([]);
  protected readonly allMatches = signal<MatchGame[]>([]);
  protected readonly displayedColumns = ['rank', 'team', 'record', 'scoring', 'points', 'updatedAt'];
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly canManage = computed(() => this.authorization.canManage('standings'));
  protected readonly selectedContextLabel = computed(() => {
    const filters = this.filtersForm.getRawValue();
    const labels = [
      this.tournamentName(Number(filters.tournamentId)),
      this.stageName(Number(filters.stageId)),
      this.groupName(Number(filters.groupId))
    ].filter((label) => Boolean(label));

    return labels.length > 0 ? labels.join(' / ') : 'Vista general';
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const rows = this.rows();
    const topTeam = rows[0];
    const totalPoints = rows.reduce((acc, item) => acc + item.points, 0);
    const totalPlayed = rows.reduce((acc, item) => acc + item.played, 0);

    return [
      {
        label: 'Contexto activo',
        value: this.page()?.totalElements ?? 0,
        meta: this.selectedContextLabel(),
        accent: true
      },
      {
        label: 'Equipos en pagina',
        value: rows.length,
        meta: 'Registros visibles en la tabla'
      },
      {
        label: 'Partidos acumulados',
        value: totalPlayed,
        meta: 'Suma de PJ del bloque visible'
      },
      {
        label: 'Lider actual',
        value: topTeam?.points ?? 0,
        meta: topTeam ? this.tournamentTeamLabel(topTeam.tournamentTeamId) : 'Sin datos'
      },
      {
        label: 'Puntos visibles',
        value: totalPoints,
        meta: 'Suma de puntos en pagina'
      }
    ];
  });
  protected readonly filteredStages = computed(() => {
    const tournamentId = Number(this.filtersForm.controls.tournamentId.getRawValue());
    return tournamentId ? this.stages().filter((item) => item.tournamentId === tournamentId) : this.stages();
  });
  protected readonly filteredGroups = computed(() => {
    const stageId = Number(this.filtersForm.controls.stageId.getRawValue());
    return stageId ? this.groups().filter((item) => item.stageId === stageId) : [];
  });
  protected readonly filteredTournamentTeams = computed(() => {
    const tournamentId = Number(this.filtersForm.controls.tournamentId.getRawValue());
    return tournamentId
      ? this.tournamentTeams().filter((item) => item.tournamentId === tournamentId)
      : this.tournamentTeams();
  });
  protected readonly standingsAuditMessage = computed(() => {
    const tournamentId = Number(this.filtersForm.controls.tournamentId.getRawValue());
    if (!tournamentId) {
      return '';
    }

    const registrations = this.tournamentTeams().filter((item) => item.tournamentId === tournamentId);
    const approvedRegistrations = registrations.filter((item) => item.registrationStatus === 'APPROVED');
    const activeRosterIds = new Set(
      this.allRosters()
        .filter((item) => item.rosterStatus === 'ACTIVE')
        .map((item) => item.tournamentTeamId)
    );
    const rosterReadyCount = approvedRegistrations.filter((item) => activeRosterIds.has(item.id)).length;
    const playedMatches = this.allMatches().filter((item) => item.tournamentId === tournamentId && item.status === 'PLAYED').length;
    const standingsCount = this.rows().length;

    if (approvedRegistrations.length === 0) {
      return 'Este torneo aun no tiene inscripciones aprobadas. La tabla no deberia ser el siguiente paso operativo.';
    }

    if (playedMatches > 0 && rosterReadyCount === 0) {
      return 'Se detectan partidos jugados sin soporte visible de roster activo. Conviene corregir la trazabilidad antes de confiar en la tabla.';
    }

    if (playedMatches > 0 && standingsCount === 0) {
      return 'Hay partidos jugados en este torneo pero el filtro actual no muestra standings. Recalcula o revisa el contexto cargado.';
    }

    if (rosterReadyCount < approvedRegistrations.length) {
      return `Solo ${rosterReadyCount} de ${approvedRegistrations.length} inscripciones aprobadas tienen roster activo. La tabla puede no reflejar una base operativa completa.`;
    }

    return '';
  });

  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [''],
    stageId: [''],
    groupId: [''],
    tournamentTeamId: ['']
  });

  constructor() {
    this.catalogLoader
      .loadAll((page, size) => this.tournamentsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournaments.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.stagesService.list({ page, size }))
      .subscribe({ next: (items) => this.stages.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.groupsService.list({ page, size }))
      .subscribe({ next: (items) => this.groups.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.teamsService.list({ page, size }))
      .subscribe({ next: (items) => this.teams.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.tournamentTeamsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournamentTeams.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.rostersService.list({ page, size }))
      .subscribe({ next: (items) => this.allRosters.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.matchesService.list({ page, size }))
      .subscribe({ next: (items) => this.allMatches.set(items) });

    this.filtersForm.controls.tournamentId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const tournamentId = Number(value);
      const validStageIds = new Set(this.stages().filter((item) => item.tournamentId === tournamentId).map((item) => item.id));
      const validTeamIds = new Set(
        this.tournamentTeams().filter((item) => item.tournamentId === tournamentId).map((item) => item.id)
      );
      const currentStageId = Number(this.filtersForm.controls.stageId.getRawValue());
      const currentTeamId = Number(this.filtersForm.controls.tournamentTeamId.getRawValue());

      this.filtersForm.patchValue(
        {
          stageId: currentStageId && validStageIds.has(currentStageId) ? String(currentStageId) : '',
          groupId: '',
          tournamentTeamId: currentTeamId && validTeamIds.has(currentTeamId) ? String(currentTeamId) : ''
        },
        { emitEvent: false }
      );
    });

    this.filtersForm.controls.stageId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const stageId = Number(value);
      const validGroupIds = new Set(this.groups().filter((item) => item.stageId === stageId).map((item) => item.id));
      const currentGroupId = Number(this.filtersForm.controls.groupId.getRawValue());

      if (currentGroupId && !validGroupIds.has(currentGroupId)) {
        this.filtersForm.patchValue({ groupId: '' }, { emitEvent: false });
      }
    });

    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.message.set('');
    const filters = this.filtersForm.getRawValue();

    this.standingsService
      .list({
        tournamentId: filters.tournamentId ? Number(filters.tournamentId) : '',
        stageId: filters.stageId ? Number(filters.stageId) : '',
        groupId: filters.groupId ? Number(filters.groupId) : '',
        tournamentTeamId: filters.tournamentTeamId ? Number(filters.tournamentTeamId) : '',
        page: this.pageIndex(),
        size: this.pageSize()
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page: StandingPage) => {
          this.page.set(page);
          this.rows.set(page.content);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected recalculate(): void {
    const filters = this.filtersForm.getRawValue();
    if (!filters.tournamentId) {
      this.notifications.error('Selecciona al menos un torneo para recalcular');
      return;
    }

    this.recalculating.set(true);
    this.standingsService
      .recalculate({
        tournamentId: Number(filters.tournamentId),
        stageId: filters.stageId ? Number(filters.stageId) : null,
        groupId: filters.groupId ? Number(filters.groupId) : null
      })
      .pipe(finalize(() => this.recalculating.set(false)))
      .subscribe({
        next: (result: StandingRecalculationResponse) => {
          this.message.set(
            `Recalculo completado. Partidos procesados: ${result.matchesProcessed}. Standings generados: ${result.standingsGenerated}.`
          );
          this.pageIndex.set(0);
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ tournamentId: '', stageId: '', groupId: '', tournamentTeamId: '' });
    this.pageIndex.set(0);
    this.message.set('');
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected tournamentTeamLabel(tournamentTeamId: number): string {
    const registration = this.tournamentTeams().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `#${tournamentTeamId}`;
    }

    const team = this.teams().find((item) => item.id === registration.teamId);
    return team ? `${team.name} (#${registration.id})` : `Equipo ${registration.teamId} (#${registration.id})`;
  }

  protected standingContext(row: Standing): string {
    return [this.stageName(row.stageId ?? 0), this.groupName(row.groupId ?? 0)]
      .filter((item) => Boolean(item))
      .join(' / ') || this.tournamentName(row.tournamentId);
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

    return this.stages().find((item) => item.id === id)?.name ?? `Etapa ${id}`;
  }

  protected groupName(id: number): string {
    if (!id) {
      return '';
    }

    return this.groups().find((item) => item.id === id)?.name ?? `Grupo ${id}`;
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }
}
