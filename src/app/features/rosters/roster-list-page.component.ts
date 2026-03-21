import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Player, PlayerPage } from '../players/player.models';
import { PlayersService } from '../players/players.service';
import { TournamentTeam, TournamentTeamPage } from '../tournament-teams/tournament-team.models';
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
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Rosters" subtitle="Roster por inscripción conectado a /rosters.">
        <a mat-flat-button color="primary" routerLink="/rosters/new">Nuevo registro</a>
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Tournament Team</mat-label>
            <mat-select formControlName="tournamentTeamId">
              <mat-option value="">Todos</mat-option>
              @for (item of tournamentTeams(); track item.id) {
                <mat-option [value]="item.id">#{{ item.id }} T{{ item.tournamentId }} / Team {{ item.teamId }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Player</mat-label>
            <mat-select formControlName="playerId">
              <mat-option value="">Todos</mat-option>
              @for (item of players(); track item.id) {
                <mat-option [value]="item.id">{{ item.firstName }} {{ item.lastName }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
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
          <div class="table-wrapper">
            <table mat-table [dataSource]="rows()" class="w-100">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let row">{{ row.id }}</td>
              </ng-container>
              <ng-container matColumnDef="playerId">
                <th mat-header-cell *matHeaderCellDef>Player</th>
                <td mat-cell *matCellDef="let row">{{ row.playerId }}</td>
              </ng-container>
              <ng-container matColumnDef="jersey">
                <th mat-header-cell *matHeaderCellDef>Camiseta</th>
                <td mat-cell *matCellDef="let row">{{ row.jerseyNumber ?? '-' }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let row">{{ row.rosterStatus }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <a mat-button [routerLink]="['/rosters', row.id, 'edit']">Editar</a>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
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
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly rows = signal<RosterEntry[]>([]);
  protected readonly players = signal<Player[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly statuses: RosterStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  protected readonly displayedColumns = ['id', 'playerId', 'jersey', 'status', 'actions'];
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentTeamId: [''],
    playerId: [''],
    rosterStatus: ['' as RosterStatus | '']
  });

  constructor() {
    this.playersService.list({ page: 0, size: 100 }).subscribe({
      next: (page: PlayerPage) => this.players.set(page.content)
    });
    this.tournamentTeamsService.list({ page: 0, size: 100 }).subscribe({
      next: (page: TournamentTeamPage) => this.tournamentTeams.set(page.content)
    });
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
        page: 0,
        size: 20
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page: RosterPage) => this.rows.set(page.content),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ tournamentTeamId: '', playerId: '', rosterStatus: '' });
    this.load();
  }
}
