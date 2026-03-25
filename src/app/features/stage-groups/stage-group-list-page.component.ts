import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { TournamentStage } from '../tournament-stages/tournament-stage.models';
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
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Stage Groups" subtitle="Grupos conectados a /stage-groups.">
        @if (canManage()) {
          <a mat-flat-button color="primary" routerLink="/stage-groups/new">Nuevo grupo</a>
        }
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
            <mat-label>Codigo</mat-label>
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
          <p class="muted">Total: {{ page()?.totalElements ?? 0 }}</p>

          <div class="table-wrapper">
            <table mat-table [dataSource]="rows()" class="w-100">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let row">{{ row.id }}</td>
              </ng-container>
              <ng-container matColumnDef="stage">
                <th mat-header-cell *matHeaderCellDef>Etapa</th>
                <td mat-cell *matCellDef="let row">{{ stageName(row.stageId) }}</td>
              </ng-container>
              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef>Codigo</th>
                <td mat-cell *matCellDef="let row">{{ row.code }}</td>
              </ng-container>
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let row">{{ row.name }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  @if (canManage()) {
                    <a mat-button [routerLink]="['/stage-groups', row.id, 'edit']">Editar</a>
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
export class StageGroupListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly groupsService = inject(StageGroupsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly page = signal<StageGroupPage | null>(null);
  protected readonly rows = signal<StageGroup[]>([]);
  protected readonly stages = signal<TournamentStage[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly canManage = computed(() => this.authorization.canManage('stageGroups'));
  protected readonly canDelete = computed(() => this.authorization.canDelete('stageGroups'));
  protected readonly displayedColumns = computed(() => {
    const columns = ['id', 'stage', 'code', 'name'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });
  protected readonly filtersForm = this.fb.nonNullable.group({
    stageId: [''],
    code: ['']
  });

  constructor() {
    this.catalogLoader
      .loadAll((page, size) => this.stagesService.list({ page, size }))
      .subscribe({ next: (items) => this.stages.set(items) });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    this.groupsService
      .list({
        stageId: filters.stageId ? Number(filters.stageId) : '',
        code: filters.code,
        page: this.pageIndex(),
        size: this.pageSize()
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page: StageGroupPage) => {
          this.page.set(page);
          this.rows.set(page.content);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ stageId: '', code: '' });
    this.pageIndex.set(0);
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected stageName(id: number): string {
    return this.stages().find((item) => item.id === id)?.name ?? `#${id}`;
  }

  protected remove(row: StageGroup): void {
    if (!window.confirm(`Se eliminara el grupo "${row.name}". Esta accion no se puede deshacer.`)) {
      return;
    }

    this.loading.set(true);
    this.groupsService
      .delete(row.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Grupo eliminado correctamente');
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }
}
