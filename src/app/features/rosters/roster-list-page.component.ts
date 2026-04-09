import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
    MatFormFieldModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Planteles" subtitle="Jugadores habilitados por inscripcion y torneo.">
        @if (canManage()) {
          <a mat-flat-button color="primary" routerLink="/rosters/new">Nuevo registro</a>
        }
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Inscripcion</mat-label>
            <mat-select formControlName="tournamentTeamId">
              <mat-option value="">Todos</mat-option>
              @for (item of tournamentTeams(); track item.id) {
                <mat-option [value]="item.id">{{ tournamentTeamLabel(item.id) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Jugador</mat-label>
            <mat-select formControlName="playerId">
              <mat-option value="">Todos</mat-option>
              @for (item of players(); track item.id) {
                <mat-option [value]="item.id">{{ item.firstName }} {{ item.lastName }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

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
              <p class="muted">Crea un nuevo registro o ajusta el filtro para continuar la operacion del torneo.</p>
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
                  <td mat-cell *matCellDef="let row">{{ row.startDate }}{{ row.endDate ? ' a ' + row.endDate : ' en adelante' }}</td>
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
  protected readonly selectedContextLabel = computed(() => {
    const filters = this.filtersForm.getRawValue();
    const labels = [
      this.tournamentTeamLabel(Number(filters.tournamentTeamId)),
      this.playerName(Number(filters.playerId)),
      this.statusLabel(filters.rosterStatus)
    ].filter((label) => Boolean(label));

    return labels.length > 0 ? labels.join(' / ') : 'Todos los registros de plantel';
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const rows = this.rows();
    const active = rows.filter((item) => item.rosterStatus === 'ACTIVE').length;
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
        meta: 'Jugadores habilitados'
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
    tournamentTeamId: [0 as number | ''],
    playerId: [0 as number | ''],
    rosterStatus: ['' as RosterStatus | '']
  });

  constructor() {
    const queryParams = this.route.snapshot.queryParamMap;
    this.filtersForm.patchValue({
      tournamentTeamId: parseQueryNumber(queryParams.get('tournamentTeamId')),
      playerId: parseQueryNumber(queryParams.get('playerId')),
      rosterStatus: (queryParams.get('rosterStatus') as RosterStatus | null) ?? ''
    });

    this.catalogLoader
      .loadAll((page, size) => this.playersService.list({ page, size }))
      .subscribe({ next: (items) => this.players.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.tournamentTeamsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournamentTeams.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.teamsService.list({ page, size }))
      .subscribe({ next: (items) => this.teams.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.tournamentsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournaments.set(items) });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    this.rostersService
      .list({
        tournamentTeamId: filters.tournamentTeamId ? Number(filters.tournamentTeamId) : '',
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
    this.filtersForm.setValue({ tournamentTeamId: '', playerId: '', rosterStatus: '' });
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
    const tournamentLabel = tournament?.name ?? `Torneo ${registration.tournamentId}`;
    return `${teamLabel} / ${tournamentLabel}`;
  }

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

  protected remove(row: RosterEntry): void {
    if (!window.confirm(`Se eliminara el registro de plantel #${row.id}. Esta accion no se puede deshacer.`)) {
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
  }
}
