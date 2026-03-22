import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Team, TeamPage } from './team.models';
import { TeamsService } from './teams.service';

@Component({
  selector: 'app-team-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Teams" subtitle="Listado operativo conectado al endpoint /teams con filtros basicos.">
        @if (canManage()) {
          <a mat-flat-button color="primary" routerLink="/teams/new">Nuevo equipo</a>
        }
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="name">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Codigo</mat-label>
            <input matInput formControlName="code">
          </mat-form-field>

          <mat-checkbox formControlName="activeOnly">Solo activos</mat-checkbox>
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
                <td mat-cell *matCellDef="let team">{{ team.id }}</td>
              </ng-container>

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let team">{{ team.name }}</td>
              </ng-container>

              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef>Codigo</th>
                <td mat-cell *matCellDef="let team">{{ team.code || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let team">
                  <span class="chip-status" [class.active]="team.active" [class.inactive]="!team.active">
                    {{ team.active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let team">
                  @if (canManage()) {
                    <a mat-button [routerLink]="['/teams', team.id, 'edit']">Editar</a>
                  }
                  @if (canDelete()) {
                    <button mat-button type="button" color="warn" (click)="remove(team)">Eliminar</button>
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
export class TeamListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly teamsService = inject(TeamsService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly page = signal<TeamPage | null>(null);
  protected readonly rows = signal<Team[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly canManage = computed(() => this.authorization.canManage('teams'));
  protected readonly canDelete = computed(() => this.authorization.canDelete('teams'));
  protected readonly displayedColumns = computed(() => {
    const columns = ['id', 'name', 'code', 'status'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });

  protected readonly filtersForm = this.fb.nonNullable.group({
    name: [''],
    code: [''],
    activeOnly: [true]
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);

    const filters = this.filtersForm.getRawValue();
    this.teamsService
      .list({
        name: filters.name,
        code: filters.code,
        active: filters.activeOnly ? true : '',
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
    this.filtersForm.setValue({
      name: '',
      code: '',
      activeOnly: true
    });
    this.pageIndex.set(0);
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected remove(team: Team): void {
    if (!window.confirm(`Se eliminara el equipo "${team.name}". Esta accion no se puede deshacer.`)) {
      return;
    }

    this.loading.set(true);
    this.teamsService
      .delete(team.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Equipo eliminado correctamente');
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }
}
