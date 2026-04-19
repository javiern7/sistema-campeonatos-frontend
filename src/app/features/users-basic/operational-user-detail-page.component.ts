import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import {
  OperationalPermission,
  OperationalRoleCatalogItem,
  OperationalRoleCode,
  OperationalUserDetail,
  OperationalUserPermissionSummary,
  OperationalUserStatus,
  OperationalUserStatusCatalogItem
} from './users-basic.models';
import { UsersBasicService } from './users-basic.service';

@Component({
  selector: 'app-operational-user-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header
        title="Detalle operativo de usuario"
        subtitle="Lectura administrativa, permisos efectivos y cambios controlados por banderas backend."
      >
        <a mat-stroked-button routerLink="/operations/users">Volver al listado</a>
      </app-page-header>

      <section class="card page-card app-page">
        @if (loading()) {
          <app-loading-state label="Cargando detalle operativo..." />
        } @else if (user()) {
          <div class="context-banner">
            <strong>{{ user()!.fullName || user()!.username }}</strong>
            <span class="muted">{{ user()!.username }} · {{ user()!.email }}</span>
          </div>

          <div class="summary-grid">
            <article class="summary-card card accent">
              <span class="summary-label">Estado</span>
              <span class="summary-value compact-value">{{ statusLabel(user()!.status) }}</span>
              <span class="summary-meta">{{ user()!.statusManageable ? 'Gestionable' : statusReason() }}</span>
            </article>

            <article class="summary-card card">
              <span class="summary-label">Roles asignados</span>
              <span class="summary-value">{{ user()!.roles.length }}</span>
              <span class="summary-meta">{{ user()!.rolesManageable ? 'Gestionables' : rolesReason() }}</span>
            </article>

            <article class="summary-card card">
              <span class="summary-label">Permisos efectivos</span>
              <span class="summary-value">{{ permissions().length }}</span>
              <span class="summary-meta">Calculados por backend desde roles y fallback vigente</span>
            </article>
          </div>

          <section class="detail-grid">
            <article class="detail-panel">
              <h2>Datos operativos</h2>
              <dl class="data-list">
                <div>
                  <dt>ID</dt>
                  <dd>{{ user()!.userId }}</dd>
                </div>
                <div>
                  <dt>Nombres</dt>
                  <dd>{{ user()!.firstName || 'Sin nombre registrado' }}</dd>
                </div>
                <div>
                  <dt>Apellidos</dt>
                  <dd>{{ user()!.lastName || 'Sin apellido registrado' }}</dd>
                </div>
                <div>
                  <dt>Ultimo acceso</dt>
                  <dd>{{ dateLabel(user()!.lastLoginAt) }}</dd>
                </div>
              </dl>
            </article>

            <article class="detail-panel">
              <h2>Cambio de estado</h2>
              @if (!canManageUsers()) {
                <p class="muted">Tu sesion tiene solo lectura para usuarios.</p>
              } @else if (!user()!.statusManageable) {
                <p class="muted">{{ statusReason() }}</p>
              } @else {
                <form [formGroup]="statusForm" class="stack-sm">
                  <mat-form-field appearance="outline">
                    <mat-label>Nuevo estado</mat-label>
                    <mat-select formControlName="status">
                      @for (status of availableStatuses(); track status.code) {
                        <mat-option [value]="status.code">{{ status.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <button mat-flat-button color="primary" type="button" [disabled]="savingStatus()" (click)="changeStatus()">
                    {{ savingStatus() ? 'Actualizando...' : 'Cambiar estado' }}
                  </button>
                </form>
              }
            </article>
          </section>

          <section class="detail-panel">
            <div class="section-heading">
              <div>
                <h2>Roles</h2>
                <p class="muted">El backend define asignabilidad, mutabilidad y motivos de bloqueo.</p>
              </div>
              @if (canManageUsers() && user()!.rolesManageable) {
                <button mat-flat-button color="primary" type="button" [disabled]="savingRoles()" (click)="changeRoles()">
                  {{ savingRoles() ? 'Guardando...' : 'Guardar roles' }}
                </button>
              }
            </div>

            @if (!user()!.rolesManageable) {
              <p class="muted">{{ rolesReason() }}</p>
            }

            <div class="role-grid">
              @for (role of rolesCatalog(); track role.roleCode) {
                <label class="role-option" [class.disabled]="!role.assignable || !user()!.rolesManageable || !canManageUsers()">
                  <mat-checkbox
                    [checked]="isRoleSelected(role.roleCode)"
                    [disabled]="!canManageUsers() || !user()!.rolesManageable || !role.assignable"
                    (change)="toggleRole(role.roleCode, $event.checked)"
                  />
                  <span>
                    <strong>{{ role.roleName || role.roleCode }}</strong>
                    <small class="muted">{{ role.description || role.manageabilityReason || role.roleCode }}</small>
                  </span>
                </label>
              }
            </div>
          </section>

          <section class="detail-panel">
            <h2>Permisos efectivos</h2>
            @if (permissions().length === 0) {
              <div class="empty-state">
                <strong>Sin permisos visibles.</strong>
                <p class="muted">El backend no devolvio permisos efectivos para este usuario.</p>
              </div>
            } @else {
              <div class="table-wrapper">
                <table mat-table [dataSource]="permissions()" class="w-100">
                  <ng-container matColumnDef="code">
                    <th mat-header-cell *matHeaderCellDef>Codigo</th>
                    <td mat-cell *matCellDef="let permission">{{ permission.code }}</td>
                  </ng-container>

                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Nombre</th>
                    <td mat-cell *matCellDef="let permission">{{ permission.name || permission.code }}</td>
                  </ng-container>

                  <ng-container matColumnDef="description">
                    <th mat-header-cell *matHeaderCellDef>Descripcion</th>
                    <td mat-cell *matCellDef="let permission">{{ permission.description || 'Sin descripcion disponible' }}</td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="permissionColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: permissionColumns"></tr>
                </table>
              </div>
            }
          </section>
        } @else {
          <div class="empty-state">
            <strong>No se pudo cargar el usuario.</strong>
            <p class="muted">Vuelve al listado e intenta nuevamente.</p>
          </div>
        }
      </section>
    </section>
  `,
  styles: [
    `
      .detail-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .detail-panel {
        display: grid;
        gap: 1rem;
        min-width: 0;
        padding: 1rem;
        border: 1px solid rgba(15, 23, 42, 0.1);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.72);
      }

      .detail-panel h2,
      .detail-panel p {
        margin: 0;
      }

      .data-list {
        display: grid;
        gap: 0.75rem;
        margin: 0;
      }

      .data-list div {
        display: grid;
        gap: 0.2rem;
      }

      .data-list dt {
        color: var(--text-soft);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .data-list dd {
        margin: 0;
        overflow-wrap: anywhere;
      }

      .compact-value {
        font-size: 1.35rem;
      }

      .section-heading {
        display: flex;
        gap: 1rem;
        align-items: start;
        justify-content: space-between;
      }

      .role-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .role-option {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        padding: 0.85rem;
        border: 1px solid rgba(10, 110, 90, 0.14);
        border-radius: 8px;
        background: #ffffff;
      }

      .role-option.disabled {
        opacity: 0.68;
      }

      .role-option span {
        display: grid;
        gap: 0.25rem;
        min-width: 0;
      }

      .role-option small,
      .role-option strong {
        overflow-wrap: anywhere;
      }

      @media (max-width: 720px) {
        .section-heading {
          align-items: stretch;
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperationalUserDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly usersBasicService = inject(UsersBasicService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly savingStatus = signal(false);
  protected readonly savingRoles = signal(false);
  protected readonly user = signal<OperationalUserDetail | null>(null);
  protected readonly permissionsSummary = signal<OperationalUserPermissionSummary | null>(null);
  protected readonly rolesCatalog = signal<OperationalRoleCatalogItem[]>([]);
  protected readonly statusesCatalog = signal<OperationalUserStatusCatalogItem[]>([]);
  protected readonly selectedRoleCodes = signal<OperationalRoleCode[]>([]);
  protected readonly permissionColumns = ['code', 'name', 'description'];
  protected readonly canManageUsers = computed(() => this.authorization.canManage('users'));
  protected readonly permissions = computed<OperationalPermission[]>(() => this.permissionsSummary()?.permissions ?? []);
  protected readonly availableStatuses = computed(() => {
    const currentStatus = this.user()?.status;
    return this.statusesCatalog().filter((status) => status.code !== currentStatus);
  });
  protected readonly statusReason = computed(() => this.user()?.statusManageabilityReason || 'Estado no gestionable');
  protected readonly rolesReason = computed(() => this.user()?.rolesManageabilityReason || 'Roles no gestionables');

  protected readonly statusForm = this.fb.nonNullable.group({
    status: ['' as OperationalUserStatus]
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    const userId = this.userId();
    if (!userId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    forkJoin({
      user: this.usersBasicService.getUserDetail(userId),
      permissions: this.usersBasicService.getUserPermissions(userId),
      roles: this.usersBasicService.listRoles(),
      statuses: this.usersBasicService.listUserStatuses()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ user, permissions, roles, statuses }) => {
          this.applyUser(user);
          this.permissionsSummary.set(permissions);
          this.rolesCatalog.set(roles);
          this.statusesCatalog.set(statuses);
          this.statusForm.setValue({ status: this.availableStatuses()[0]?.code ?? '' });
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
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

  protected isRoleSelected(roleCode: OperationalRoleCode): boolean {
    return this.selectedRoleCodes().includes(roleCode);
  }

  protected toggleRole(roleCode: OperationalRoleCode, checked: boolean): void {
    this.selectedRoleCodes.update((roleCodes) => {
      if (checked) {
        return roleCodes.includes(roleCode) ? roleCodes : [...roleCodes, roleCode];
      }

      return roleCodes.filter((item) => item !== roleCode);
    });
  }

  protected changeStatus(): void {
    const user = this.user();
    const status = this.statusForm.getRawValue().status;
    if (!user || !status || status === user.status) {
      return;
    }

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

    this.savingStatus.set(true);
    this.usersBasicService
      .updateUserStatus(user.userId, { status, reason: normalizedReason })
      .pipe(finalize(() => this.savingStatus.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success(`Estado actualizado a ${this.statusLabel(status).toLowerCase()}.`);
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected changeRoles(): void {
    const user = this.user();
    const roleCodes = this.selectedRoleCodes();
    if (!user) {
      return;
    }

    if (roleCodes.length === 0) {
      this.notifications.error('Debes seleccionar al menos un rol.');
      return;
    }

    if (!window.confirm(`Se reemplazara el conjunto completo de roles de ${user.fullName || user.username}.`)) {
      return;
    }

    const reason = window.prompt(`Motivo del cambio de roles para ${user.fullName || user.username}:`, 'Ajuste operativo de roles');
    if (reason === null) {
      return;
    }

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      this.notifications.error('Debes indicar un motivo para cambiar roles.');
      return;
    }

    this.savingRoles.set(true);
    this.usersBasicService
      .updateUserRoles(user.userId, { roleCodes, reason: normalizedReason })
      .pipe(finalize(() => this.savingRoles.set(false)))
      .subscribe({
        next: (updatedUser) => {
          this.notifications.success('Roles actualizados correctamente.');
          this.applyUser(updatedUser);
          this.reloadPermissions(updatedUser.userId);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  private reloadPermissions(userId: number): void {
    this.usersBasicService.getUserPermissions(userId).subscribe({
      next: (permissions) => this.permissionsSummary.set(permissions),
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }

  private applyUser(user: OperationalUserDetail): void {
    this.user.set(user);
    this.selectedRoleCodes.set(user.roles.map((role) => role.roleCode));
  }

  private userId(): number | null {
    const value = Number(this.route.snapshot.paramMap.get('userId'));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
}
