import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Tournament, TournamentPage } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { TournamentStage, TournamentStagePage, TournamentStageType } from './tournament-stage.models';
import { TournamentStagesService } from './tournament-stages.service';

@Component({
  selector: 'app-tournament-stage-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Tournament Stages" subtitle="Etapas conectadas a /tournament-stages.">
        <a mat-flat-button color="primary" routerLink="/tournament-stages/new">Nueva etapa</a>
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
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="stageType">
              <mat-option value="">Todos</mat-option>
              @for (type of types; track type) {
                <mat-option [value]="type">{{ type }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-checkbox formControlName="activeOnly">Solo activas</mat-checkbox>
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
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Etapa</th>
                <td mat-cell *matCellDef="let row">{{ row.name }}</td>
              </ng-container>
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">{{ row.stageType }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <a mat-button [routerLink]="['/tournament-stages', row.id, 'edit']">Editar</a>
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
export class TournamentStageListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly rows = signal<TournamentStage[]>([]);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly types: TournamentStageType[] = ['LEAGUE', 'GROUP_STAGE', 'KNOCKOUT'];
  protected readonly displayedColumns = ['id', 'name', 'type', 'actions'];
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [''],
    stageType: ['' as TournamentStageType | ''],
    activeOnly: [true]
  });

  constructor() {
    this.tournamentsService.list({ page: 0, size: 100 }).subscribe({
      next: (page: TournamentPage) => this.tournaments.set(page.content)
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    this.stagesService
      .list({
        tournamentId: filters.tournamentId ? Number(filters.tournamentId) : '',
        stageType: filters.stageType,
        active: filters.activeOnly ? true : '',
        page: 0,
        size: 20
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page: TournamentStagePage) => this.rows.set(page.content),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ tournamentId: '', stageType: '', activeOnly: true });
    this.load();
  }
}
