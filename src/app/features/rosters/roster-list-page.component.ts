import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Player } from '../players/player.models';
import { PlayersService } from '../players/players.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { RosterEntry, RosterPage, RosterStatus } from './roster.models';
import { RostersService } from './rosters.service';

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
      <app-page-header title="Rosters" subtitle="Roster por inscripcion conectado a /rosters.">
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
                <mat-option [value]="item.id">#{{ item.id }}</mat-option>
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
                <mat-option [value]="status">{{ status }}</mat-option>
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
          <p class="muted">Total: {{ page()?.totalElements ?? 0 }}</p>

          <div class="table-wrapper">
            <table mat-table [dataSource]="rows()" class="w-100">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let row">{{ row.id }}</td>
              </ng-container>
              <ng-container matColumnDef="player">
                <th mat-header-cell *matHeaderCellDef>Jugador</th>
                <td mat-cell *matCellDef="let row">{{ playerName(row.playerId) }}</td>
              </ng-container>
              <ng-container matColumnDef="jersey">
                <th mat-header-cell *matHeaderCellDef>Camiseta</th>
                <td mat-cell *matCellDef="let row">{{ row.jerseyNumber ?? '-' }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">{{ row.rosterStatus }}</td>
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
  private readonly rostersService = inject(RostersService);
  private readonly playersService = inject(PlayersService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly page = signal<RosterPage | null>(null);
  protected readonly rows = signal<RosterEntry[]>([]);
  protected readonly players = signal<Player[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly statuses: RosterStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  protected readonly canManage = computed(() => this.authorization.canManage('rosters'));
  protected readonly canDelete = computed(() => this.authorization.canDelete('rosters'));
  protected readonly displayedColumns = computed(() => {
    const columns = ['id', 'player', 'jersey', 'status'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentTeamId: [''],
    playerId: [''],
    rosterStatus: ['' as RosterStatus | '']
  });

  constructor() {
    this.catalogLoader
      .loadAll((page, size) => this.playersService.list({ page, size }))
      .subscribe({ next: (items) => this.players.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.tournamentTeamsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournamentTeams.set(items) });
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
    const player = this.players().find((item) => item.id === id);
    return player ? `${player.firstName} ${player.lastName}` : `#${id}`;
  }

  protected remove(row: RosterEntry): void {
    if (!window.confirm(`Se eliminara el registro de roster #${row.id}. Esta accion no se puede deshacer.`)) {
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
