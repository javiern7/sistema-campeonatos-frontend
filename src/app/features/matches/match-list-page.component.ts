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
import { StageGroup, StageGroupPage } from '../stage-groups/stage-group.models';
import { StageGroupsService } from '../stage-groups/stage-groups.service';
import { TournamentStage, TournamentStagePage } from '../tournament-stages/tournament-stage.models';
import { TournamentStagesService } from '../tournament-stages/tournament-stages.service';
import { Tournament, TournamentPage } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { MatchGame, MatchPage, MatchStatus } from './match.models';
import { MatchesService } from './matches.service';

@Component({
  selector: 'app-match-list-page',
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
      <app-page-header title="Matches" subtitle="Partidos conectados a /matches.">
        <a mat-flat-button color="primary" routerLink="/matches/new">Nuevo partido</a>
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
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
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
              <ng-container matColumnDef="fixture">
                <th mat-header-cell *matHeaderCellDef>Fixture</th>
                <td mat-cell *matCellDef="let row">{{ row.homeTournamentTeamId }} vs {{ row.awayTournamentTeamId }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let row">{{ row.status }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <a mat-button [routerLink]="['/matches', row.id, 'edit']">Editar</a>
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
export class MatchListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly matchesService = inject(MatchesService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly rows = signal<MatchGame[]>([]);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly stages = signal<TournamentStage[]>([]);
  protected readonly groups = signal<StageGroup[]>([]);
  protected readonly statuses: MatchStatus[] = ['SCHEDULED', 'PLAYED', 'FORFEIT', 'CANCELLED'];
  protected readonly displayedColumns = ['id', 'fixture', 'status', 'actions'];
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [''],
    stageId: [''],
    groupId: [''],
    status: ['' as MatchStatus | '']
  });

  constructor() {
    this.tournamentsService.list({ page: 0, size: 100 }).subscribe({
      next: (page: TournamentPage) => this.tournaments.set(page.content)
    });
    this.stagesService.list({ page: 0, size: 100 }).subscribe({
      next: (page: TournamentStagePage) => this.stages.set(page.content)
    });
    this.groupsService.list({ page: 0, size: 100 }).subscribe({
      next: (page: StageGroupPage) => this.groups.set(page.content)
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
        page: 0,
        size: 20
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page: MatchPage) => this.rows.set(page.content),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ tournamentId: '', stageId: '', groupId: '', status: '' });
    this.load();
  }
}
