import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { ConfirmationDialogComponent } from '../../shared/confirmation-dialog/confirmation-dialog.component';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SearchSelectComponent } from '../../shared/search-select/search-select.component';
import { Player } from '../players/player.models';
import { PlayersService } from '../players/players.service';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { RosterEntry, RosterPage, RosterStatus } from './roster.models';
import { RostersService } from './rosters.service';

type SummaryCard = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

const parseQueryNumber = (value: string | null): number | '' => {
  if (!value) {
    return '';
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : '';
};

@Component({
  selector: 'app-roster-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent,
    SearchSelectComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Planteles" subtitle="Jugadores habilitados por inscripcion y campeonato.">
        @if (canManage()) {
          <a mat-flat-button color="primary" routerLink="/rosters/new">Nuevo registro</a>
        }
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
          <app-search-select
            formControlName="tournamentId"
            label="Campeonato"
            placeholder="Busca un campeonato"
            [options]="tournaments()"
            [labelFn]="tournamentOptionLabel"
            [searchTextFn]="tournamentOptionLabel"
            emptyOptionLabel="Todos"
          />

          <app-search-select
            formControlName="tournamentTeamId"
            label="Equipo inscrito"
            placeholder="Busca un equipo inscrito"
            [options]="filteredTournamentTeams()"
            [labelFn]="tournamentTeamOptionLabel"
            [searchTextFn]="tournamentTeamOptionLabel"
            [emptyOptionLabel]="selectedTournamentId() ? 'Todos los equipos del campeonato' : 'Todos'"
            [hint]="selectedTournamentId() && filteredTournamentTeams().length === 0 ? 'Este campeonato aun no tiene equipos inscritos.' : ''"
          />

          <app-search-select
            formControlName="playerId"
            label="Jugador"
            placeholder="Busca un jugador"
            [options]="players()"
            [labelFn]="playerOptionLabel"
            [searchTextFn]="playerOptionLabel"
            emptyOptionLabel="Todos"
          />

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="rosterStatus">
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
            <span class="muted">Total filtrado: {{ page()?.totalElements ?? 0 }} registros de plantel</span>
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
              <strong>No hay registros de plantel para este filtro.</strong>
              <p class="muted">Crea un nuevo registro o ajusta el filtro para continuar la operacion del campeonato.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="rows()" class="w-100">
                <ng-container matColumnDef="registration">
                  <th mat-header-cell *matHeaderCellDef>Inscripcion</th>
                  <td mat-cell *matCellDef="let row">{{ tournamentTeamLabel(row.tournamentTeamId) }}</td>
                </ng-container>
                <ng-container matColumnDef="player">
                  <th mat-header-cell *matHeaderCellDef>Jugador</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <strong>{{ playerName(row.playerId) }}</strong>
                      <span class="muted">{{ row.positionName || 'Posicion sin definir' }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="jersey">
                  <th mat-header-cell *matHeaderCellDef>Camiseta</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <span>{{ row.jerseyNumber ?? '-' }}</span>
                      <span class="muted">{{ row.captain ? 'Capitan' : 'Jugador de campo' }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Estado</th>
                  <td mat-cell *matCellDef="let row">
                    <span [class]="statusClass(row.rosterStatus)">{{ statusLabel(row.rosterStatus) }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="window">
                  <th mat-header-cell *matHeaderCellDef>Vigencia</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <span>{{ validityLabel(row) }}</span>
                      <span class="muted">{{ formatRosterDate(row.startDate) }}{{ row.endDate ? ' a ' + formatRosterDate(row.endDate) : ' en adelante' }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let row">
                    @if (canManage()) {
                      <a mat-button [routerLink]="['/rosters', row.id, 'edit']">Editar</a>
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
export class RosterListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly rostersService = inject(RostersService);
  private readonly playersService = inject(PlayersService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(true);
  protected readonly page = signal<RosterPage | null>(null);
  protected readonly rows = signal<RosterEntry[]>([]);
  protected readonly players = signal<Player[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly statuses: RosterStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  protected readonly canManage = computed(() => this.authorization.canManage('rosters'));
  protected readonly canDelete = computed(() => this.authorization.canDelete('rosters'));
  protected readonly selectedTournamentId = signal(0);
  protected readonly filteredTournamentTeams = computed(() => {
    const tournamentId = this.selectedTournamentId();
    return tournamentId
      ? this.tournamentTeams().filter((item) => item.tournamentId === tournamentId)
      : this.tournamentTeams();
  });
  protected readonly selectedContextLabel = computed(() => {
    const filters = this.filtersForm.getRawValue();
    const labels = [
      this.tournamentName(Number(filters.tournamentId)),
      this.tournamentTeamLabel(Number(filters.tournamentTeamId)),
      this.playerName(Number(filters.playerId)),
      this.statusLabel(filters.rosterStatus)
    ].filter((label) => Boolean(label));

    return labels.length > 0 ? labels.join(' / ') : 'Todos los registros de plantel';
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const rows = this.rows();
    const active = rows.filter((item) => item.rosterStatus === 'ACTIVE').length;
    const validToday = rows.filter((item) => this.isRosterCurrentlyValid(item)).length;
    const captains = rows.filter((item) => item.captain).length;

    return [
      {
        label: 'Contexto activo',
        value: this.page()?.totalElements ?? 0,
        meta: this.selectedContextLabel(),
        accent: true
      },
      {
        label: 'Activos en pagina',
        value: active,
        meta: 'Por estado del plantel'
      },
      {
        label: 'Vigentes hoy',
        value: validToday,
        meta: 'Activos dentro de fecha'
      },
      {
        label: 'Capitanes en pagina',
        value: captains,
        meta: 'Referentes visibles'
      }
    ];
  });
  protected readonly displayedColumns = computed(() => {
    const columns = ['registration', 'player', 'jersey', 'status', 'window'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [0 as number | ''],
    tournamentTeamId: [0 as number | ''],
    playerId: [0 as number | ''],
    rosterStatus: ['' as RosterStatus | '']
  });

  constructor() {
    const queryParams = this.route.snapshot.queryParamMap;
    this.filtersForm.patchValue({
      tournamentId: parseQueryNumber(queryParams.get('tournamentId')),
      tournamentTeamId: parseQueryNumber(queryParams.get('tournamentTeamId')),
      playerId: parseQueryNumber(queryParams.get('playerId')),
      rosterStatus: (queryParams.get('rosterStatus') as RosterStatus | null) ?? ''
    });
    this.selectedTournamentId.set(Number(this.filtersForm.controls.tournamentId.getRawValue()));

    this.catalogLoader
      .loadAll((page, size) => this.playersService.list({ page, size }))
      .subscribe({ next: (items) => this.players.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.tournamentTeamsService.list({ page, size }))
      .subscribe({
        next: (items) => {
          this.tournamentTeams.set(items);
          const tournamentId = Number(this.filtersForm.controls.tournamentId.getRawValue());
          const tournamentTeamId = Number(this.filtersForm.controls.tournamentTeamId.getRawValue());
          if (tournamentId && !tournamentTeamId) {
            this.load();
          }
        }
      });
    this.catalogLoader
      .loadAll((page, size) => this.teamsService.list({ page, size }))
      .subscribe({ next: (items) => this.teams.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.tournamentsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournaments.set(items) });

    this.filtersForm.controls.tournamentId.valueChanges.subscribe((value) => {
      const tournamentId = Number(value);
      this.selectedTournamentId.set(tournamentId);

      const currentTournamentTeamId = Number(this.filtersForm.controls.tournamentTeamId.getRawValue());
      const validTeamIds = new Set(
        this.tournamentTeams()
          .filter((item) => !tournamentId || item.tournamentId === tournamentId)
          .map((item) => item.id)
      );

      if (currentTournamentTeamId && !validTeamIds.has(currentTournamentTeamId)) {
        this.filtersForm.patchValue({ tournamentTeamId: '' }, { emitEvent: false });
      }
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();
    const tournamentId = filters.tournamentId ? Number(filters.tournamentId) : 0;
    const tournamentTeamId = filters.tournamentTeamId ? Number(filters.tournamentTeamId) : 0;

    if (tournamentId && !tournamentTeamId) {
      const tournamentTeamIds = new Set(
        this.tournamentTeams()
          .filter((item) => item.tournamentId === tournamentId)
          .map((item) => item.id)
      );

      this.catalogLoader
        .loadAll((page, size) =>
          this.rostersService.list({
            playerId: filters.playerId ? Number(filters.playerId) : '',
            rosterStatus: filters.rosterStatus,
            page,
            size
          })
        )
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (items) => {
            const filtered = items.filter((item) => tournamentTeamIds.has(item.tournamentTeamId));
            this.applyClientPage(filtered);
          },
          error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
        });
      return;
    }

    this.rostersService
      .list({
        tournamentTeamId: tournamentTeamId || '',
        playerId: filters.playerId ? Number(filters.playerId) : '',
        rosterStatus: filters.rosterStatus,
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
    this.filtersForm.setValue({ tournamentId: '', tournamentTeamId: '', playerId: '', rosterStatus: '' });
    this.selectedTournamentId.set(0);
    this.pageIndex.set(0);
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected playerName(id: number): string {
    if (!id) {
      return '';
    }

    const player = this.players().find((item) => item.id === id);
    return player ? `${player.firstName} ${player.lastName}` : `#${id}`;
  }

  protected tournamentTeamLabel(id: number): string {
    if (!id) {
      return '';
    }

    const registration = this.tournamentTeams().find((item) => item.id === id);
    if (!registration) {
      return `#${id}`;
    }

    const team = this.teams().find((item) => item.id === registration.teamId);
    const tournament = this.tournaments().find((item) => item.id === registration.tournamentId);
    const teamLabel = team?.name ?? `Equipo ${registration.teamId}`;
    const tournamentLabel = tournament?.name ?? `Campeonato ${registration.tournamentId}`;
    return `${teamLabel} / ${tournamentLabel}`;
  }

  protected tournamentName(id: number): string {
    if (!id) {
      return '';
    }

    return this.tournaments().find((item) => item.id === id)?.name ?? `Campeonato ${id}`;
  }

  protected readonly tournamentOptionLabel = (item: Tournament): string => item.name;

  protected readonly playerOptionLabel = (item: Player): string => `${item.firstName} ${item.lastName}`;

  protected readonly tournamentTeamOptionLabel = (item: TournamentTeam): string => this.tournamentTeamLabel(item.id);

  protected statusLabel(status: RosterStatus | ''): string {
    const labels: Record<RosterStatus, string> = {
      ACTIVE: 'Activo',
      INACTIVE: 'Inactivo',
      SUSPENDED: 'Suspendido'
    };

    return status ? labels[status] : '';
  }

  protected statusClass(status: RosterStatus): string {
    const statusMap: Record<RosterStatus, string> = {
      ACTIVE: 'status-pill played',
      INACTIVE: 'status-pill cancelled',
      SUSPENDED: 'status-pill forfeit'
    };

    return statusMap[status];
  }

  protected validityLabel(row: RosterEntry): string {
    if (row.rosterStatus !== 'ACTIVE') {
      return 'No disponible para competir';
    }

    const today = this.todayIso();
    if (row.startDate > today) {
      return 'Activo, inicia despues';
    }

    if (row.endDate && row.endDate < today) {
      return 'Activo, pero vencido';
    }

    return 'Activo y vigente';
  }

  private isRosterCurrentlyValid(row: RosterEntry): boolean {
    const today = this.todayIso();
    return row.rosterStatus === 'ACTIVE' && row.startDate <= today && (!row.endDate || row.endDate >= today);
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  protected formatRosterDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  private applyClientPage(items: RosterEntry[]): void {
    const start = this.pageIndex() * this.pageSize();
    const content = items.slice(start, start + this.pageSize());
    this.page.set({
      content,
      page: this.pageIndex(),
      number: this.pageIndex(),
      totalElements: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / this.pageSize())),
      size: this.pageSize(),
      first: this.pageIndex() === 0,
      last: start + this.pageSize() >= items.length
    });
    this.rows.set(content);
  }

  protected remove(row: RosterEntry): void {
    this.dialog
      .open(ConfirmationDialogComponent, {
        data: {
          title: 'Eliminar jugador del plantel',
          description: `Se quitara a ${this.playerName(row.playerId) || 'este jugador'} del plantel seleccionado. Esta accion no se puede deshacer.`,
          confirmLabel: 'Eliminar registro',
          destructive: true
        }
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.loading.set(true);
        this.rostersService
          .delete(row.id)
          .pipe(finalize(() => this.loading.set(false)))
          .subscribe({
            next: () => {
              this.notifications.success('Registro eliminado correctamente');
              this.load();
            },
            error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
          });
      });
  }
}
