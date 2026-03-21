import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { TournamentStage, TournamentStagePage } from '../tournament-stages/tournament-stage.models';
import { TournamentStagesService } from '../tournament-stages/tournament-stages.service';
import { StageGroup, StageGroupPage } from './stage-group.models';
import { StageGroupsService } from './stage-groups.service';

@Component({
  selector: 'app-stage-group-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Stage Groups" subtitle="Grupos conectados a /stage-groups.">
        <a mat-flat-button color="primary" routerLink="/stage-groups/new">Nuevo grupo</a>
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
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
            <mat-label>Código</mat-label>
            <input matInput formControlName="code">
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
              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef>Código</th>
                <td mat-cell *matCellDef="let row">{{ row.code }}</td>
              </ng-container>
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let row">{{ row.name }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <a mat-button [routerLink]="['/stage-groups', row.id, 'edit']">Editar</a>
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
export class StageGroupListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly groupsService = inject(StageGroupsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly rows = signal<StageGroup[]>([]);
  protected readonly stages = signal<TournamentStage[]>([]);
  protected readonly displayedColumns = ['id', 'code', 'name', 'actions'];
  protected readonly filtersForm = this.fb.nonNullable.group({
    stageId: [''],
    code: ['']
  });

  constructor() {
    this.stagesService.list({ page: 0, size: 100 }).subscribe({
      next: (page: TournamentStagePage) => this.stages.set(page.content)
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    this.groupsService
      .list({
        stageId: filters.stageId ? Number(filters.stageId) : '',
        code: filters.code,
        page: 0,
        size: 20
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page: StageGroupPage) => this.rows.set(page.content),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ stageId: '', code: '' });
    this.load();
  }
}
