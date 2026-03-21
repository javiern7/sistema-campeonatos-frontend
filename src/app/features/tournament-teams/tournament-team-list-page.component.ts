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
import { Team, TeamPage } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { Tournament, TournamentPage } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import {
  TournamentTeam,
  TournamentTeamPage,
  TournamentTeamRegistrationStatus
} from './tournament-team.models';
import { TournamentTeamsService } from './tournament-teams.service';

@Component({
  selector: 'app-tournament-team-list-page',
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
      <app-page-header title="Tournament Teams" subtitle="Inscripciones conectadas a /tournament-teams.">
        <a mat-flat-button color="primary" routerLink="/tournament-teams/new">Nueva inscripción</a>
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
            <mat-label>Equipo</mat-label>
            <mat-select formControlName="teamId">
              <mat-option value="">Todos</mat-option>
              @for (item of teams(); track item.id) {
                <mat-option [value]="item.id">{{ item.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="registrationStatus">
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
              <ng-container matColumnDef="tournamentId">
                <th mat-header-cell *matHeaderCellDef>Torneo</th>
                <td mat-cell *matCellDef="let row">{{ row.tournamentId }}</td>
              </ng-container>
              <ng-container matColumnDef="teamId">
                <th mat-header-cell *matHeaderCellDef>Equipo</th>
                <td mat-cell *matCellDef="let row">{{ row.teamId }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">{{ row.registrationStatus }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <a mat-button [routerLink]="['/tournament-teams', row.id, 'edit']">Editar</a>
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
export class TournamentTeamListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly rows = signal<TournamentTeam[]>([]);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly statuses: TournamentTeamRegistrationStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
  protected readonly displayedColumns = ['id', 'tournamentId', 'teamId', 'status', 'actions'];
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [''],
    teamId: [''],
    registrationStatus: ['' as TournamentTeamRegistrationStatus | '']
  });

  constructor() {
    this.tournamentsService.list({ page: 0, size: 100 }).subscribe({
      next: (page: TournamentPage) => this.tournaments.set(page.content)
    });
    this.teamsService.list({ page: 0, size: 100 }).subscribe({
      next: (page: TeamPage) => this.teams.set(page.content)
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    this.tournamentTeamsService
      .list({
        tournamentId: filters.tournamentId ? Number(filters.tournamentId) : '',
        teamId: filters.teamId ? Number(filters.teamId) : '',
        registrationStatus: filters.registrationStatus,
        page: 0,
        size: 20
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page: TournamentTeamPage) => this.rows.set(page.content),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ tournamentId: '', teamId: '', registrationStatus: '' });
    this.load();
  }
}
