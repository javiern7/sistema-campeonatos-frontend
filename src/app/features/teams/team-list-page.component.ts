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
import { VisualIdentityComponent } from '../../shared/visual-identity/visual-identity.component';
import { Team, TeamPage } from './team.models';
import { TeamsService } from './teams.service';

type TeamVisualMetric = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

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
    PageHeaderComponent,
    VisualIdentityComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Equipos" subtitle="Listado operativo conectado a /teams con filtros base del catalogo deportivo.">
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
          <app-loading-state label="Cargando equipos y colores operativos..." />
        } @else {
          <div class="summary-grid">
            @for (metric of visualMetrics(); track metric.label) {
              <article class="summary-card card" [class.accent]="metric.accent">
                <span class="summary-label">{{ metric.label }}</span>
                <span class="summary-value">{{ metric.value }}</span>
                <span class="summary-meta">{{ metric.meta }}</span>
              </article>
            }
          </div>

          @if (rows().length === 0) {
            <div class="empty-state">
              <strong>No hay equipos para estos filtros.</strong>
              <p class="muted">Prueba limpiar la busqueda o desactivar "Solo activos" para revisar equipos inactivos.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="rows()" class="w-100 visual-table">
                <ng-container matColumnDef="team">
                  <th mat-header-cell *matHeaderCellDef>Equipo</th>
                  <td mat-cell *matCellDef="let team">
                    <app-visual-identity
                      [label]="team.name"
                      [shortLabel]="team.shortName"
                      [code]="team.code"
                      [primary]="team.primaryColor"
                      [secondary]="team.secondaryColor"
                      [meta]="'ID ' + team.id"
                    />
                  </td>
                </ng-container>

                <ng-container matColumnDef="colors">
                  <th mat-header-cell *matHeaderCellDef>Lectura visual</th>
                  <td mat-cell *matCellDef="let team">
                    <div class="color-stack">
                      <span class="color-line">
                        <span class="color-dot" [style.background]="colorValue(team.primaryColor)"></span>
                        Primario {{ team.primaryColor || 'deterministico' }}
                      </span>
                      <span class="color-line muted">
                        <span class="color-dot" [style.background]="colorValue(team.secondaryColor)"></span>
                        Secundario {{ team.secondaryColor || 'deterministico' }}
                      </span>
                    </div>
                  </td>
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
  styles: [
    `
      .color-stack {
        display: grid;
        gap: 0.25rem;
        min-width: 180px;
      }

      .color-line {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.9rem;
      }

      .color-dot {
        width: 0.85rem;
        height: 0.85rem;
        border: 1px solid rgba(23, 33, 43, 0.12);
        border-radius: 999px;
      }
    `
  ],
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
    const columns = ['team', 'colors', 'status'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });
  protected readonly visualMetrics = computed<TeamVisualMetric[]>(() => {
    const rows = this.rows();
    const activeCount = rows.filter((team) => team.active).length;
    const colorReadyCount = rows.filter((team) => team.primaryColor || team.secondaryColor).length;

    return [
      {
        label: 'Total filtrado',
        value: this.page()?.totalElements ?? 0,
        meta: 'Equipos segun busqueda actual',
        accent: true
      },
      {
        label: 'Activos visibles',
        value: activeCount,
        meta: 'Listos para operar'
      },
      {
        label: 'Con color maestro',
        value: colorReadyCount,
        meta: 'El resto usa iniciales deterministicas'
      }
    ];
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

  protected colorValue(value: string | null): string {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value ?? '') ? value! : '#d7dde5';
  }
}
