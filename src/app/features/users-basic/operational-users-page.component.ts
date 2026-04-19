import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import {
  OPERATIONAL_USERS_DEFAULT_SORT,
  OperationalRoleCode,
  OperationalRoleCatalogItem,
  OperationalUser,
  OperationalUserRoleValue,
  OperationalUserStatus,
  OperationalUserStatusCatalogItem,
  OperationalUsersFilters,
  OperationalUsersPage
} from './users-basic.models';
import { UsersBasicService } from './users-basic.service';

type StatusAction = {
  label: string;
  value: OperationalUserStatus;
};

@Component({
  selector: 'app-operational-users-page',
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
      <app-page-header
        title="Usuarios operativos"
        subtitle="Lectura administrativa de usuarios existentes con catalogos y gestionabilidad provistos por backend."
      />

      <section class="card page-card app-page">
        <div class="context-banner">
          <strong>Guardrail del bloque</strong>
          <span class="muted">No se crean usuarios, no se editan datos basicos y no se infieren reglas sensibles en frontend.</span>
        </div>

        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Busqueda</mat-label>
            <input matInput formControlName="query" placeholder="Usuario, nombre o correo">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="status">
              <mat-option value="">Todos</mat-option>
              @for (status of statusesCatalog(); track status.code) {
                <mat-option [value]="status.code">{{ status.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Rol</mat-label>
            <mat-select formControlName="roleCode">
              <mat-option value="">Todos</mat-option>
              @for (role of rolesCatalog(); track role.roleCode) {
                <mat-option [value]="role.roleCode">{{ role.roleName || role.roleCode }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </form>

        <div class="actions-row">
          <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
          <button mat-flat-button color="primary" type="button" (click)="load()">Buscar</button>
        </div>

        @if (loading()) {
          <app-loading-state label="Cargando usuarios operativos..." />
        } @else {
          <p class="muted">Total: {{ page()?.totalElements ?? 0 }}</p>

          @if (rows().length === 0) {
            <div class="empty-state">
              <strong>No hay usuarios para este filtro.</strong>
              <p class="muted">Ajusta texto, estado o rol para revisar la lectura operativa disponible.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="rows()" class="w-100">
                <ng-container matColumnDef="identity">
                  <th mat-header-cell *matHeaderCellDef>Usuario</th>
                  <td mat-cell *matCellDef="let user">
                    <div class="identity-cell">
                      <strong>{{ user.fullName || user.username }}</strong>
                      <span class="muted">{{ user.username }} · {{ user.email }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="roles">
                  <th mat-header-cell *matHeaderCellDef>Roles</th>
                  <td mat-cell *matCellDef="let user">{{ roleSummary(user) }}</td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Estado</th>
                  <td mat-cell *matCellDef="let user">
                    <span class="chip-status">
                      {{ statusLabel(user.status) }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="lastLoginAt">
                  <th mat-header-cell *matHeaderCellDef>Ultimo acceso</th>
                  <td mat-cell *matCellDef="let user">{{ dateLabel(user.lastLoginAt) }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let user">
                    <div class="inline-actions">
                      <a mat-button [routerLink]="['/operations/users', user.userId]">Ver detalle</a>
                      @if (!canManageUsers()) {
                        <span class="muted">Solo lectura</span>
                      } @else if (!user.statusManageable) {
                        <span class="muted">{{ user.statusManageabilityReason || 'No gestionable' }}</span>
                      } @else {
                        @for (action of statusActions(user); track action.value) {
                          <button mat-button type="button" (click)="changeStatus(user, action.value)">{{ action.label }}</button>
                        }
                      }
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
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
        }
      </section>
    </section>
  `,
  styles: [
    `
      .identity-cell,
      .inline-actions {
        display: grid;
        gap: 0.25rem;
      }

      .inline-actions {
        justify-items: start;
      }

      @media (max-width: 720px) {
        .table-wrapper {
          overflow-x: auto;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperationalUsersPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly usersBasicService = inject(UsersBasicService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly page = signal<OperationalUsersPage | null>(null);
  protected readonly rows = signal<OperationalUser[]>([]);
  protected readonly rolesCatalog = signal<OperationalRoleCatalogItem[]>([]);
  protected readonly statusesCatalog = signal<OperationalUserStatusCatalogItem[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly displayedColumns = ['identity', 'roles', 'status', 'lastLoginAt', 'actions'];
  protected readonly canManageUsers = computed(() => this.authorization.canManage('users'));

  protected readonly filtersForm = this.fb.nonNullable.group({
    query: [''],
    status: ['' as OperationalUserStatus | ''],
    roleCode: ['' as OperationalRoleCode | '']
  });

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.loading.set(true);
    forkJoin({
      roles: this.usersBasicService.listRoles(),
      statuses: this.usersBasicService.listUserStatuses(),
      page: this.usersBasicService.listUsers(this.currentFilters())
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ roles, statuses, page }) => {
          this.rolesCatalog.set(roles);
          this.statusesCatalog.set(statuses);
          this.page.set(page);
          this.rows.set(page.content);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected load(): void {
    this.loading.set(true);
    this.usersBasicService
      .listUsers(this.currentFilters())
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
      query: '',
      status: '',
      roleCode: ''
    });
    this.pageIndex.set(0);
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected roleSummary(user: OperationalUser): string {
    return user.roles.length ? user.roles.map((role) => this.roleLabel(role)).join(', ') : 'Sin roles visibles';
  }

  protected statusLabel(status: OperationalUserStatus): string {
    return this.statusesCatalog().find((item) => item.code === status)?.name ?? status;
  }

  protected dateLabel(value: string | null): string {
    if (!value) {
      return 'Sin acceso registrado';
    }

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  protected statusActions(user: OperationalUser): StatusAction[] {
    return this.statusesCatalog()
      .filter((status) => status.code !== user.status)
      .map((status) => ({
        label: status.name,
        value: status.code
      }));
  }

  private roleLabel(role: OperationalUserRoleValue): string {
    if (typeof role === 'string') {
      return role;
    }

    return role.roleName || role.roleCode;
  }

  private currentFilters(): OperationalUsersFilters {
    const filters = this.filtersForm.getRawValue();

    return {
      query: filters.query.trim(),
      status: filters.status,
      roleCode: filters.roleCode,
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: OPERATIONAL_USERS_DEFAULT_SORT
    };
  }

  protected changeStatus(user: OperationalUser, status: OperationalUserStatus): void {
    const reason = window.prompt(
      `Motivo del cambio a "${this.statusLabel(status)}" para ${user.fullName || user.username}:`,
      `Ajuste operativo de estado a ${this.statusLabel(status).toLowerCase()}`
    );

    if (reason === null) {
      return;
    }

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      this.notifications.error('Debes indicar un motivo para cambiar el estado operativo.');
      return;
    }

    this.loading.set(true);
    this.usersBasicService
      .updateUserStatus(user.userId, { status, reason: normalizedReason })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (updatedUser) => {
          this.notifications.success(`Estado actualizado a ${this.statusLabel(updatedUser.status).toLowerCase()}.`);
          this.rows.update((rows) => rows.map((row) => (row.userId === updatedUser.userId ? updatedUser : row)));
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }
}
