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
import { Player, PlayerPage } from './player.models';
import { PlayersService } from './players.service';

type PlayerVisualMetric = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

@Component({
  selector: 'app-player-list-page',
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
      <app-page-header title="Jugadores" subtitle="Listado operativo conectado a /players con busqueda y filtros base del padron.">
        @if (canManage()) {
          <a mat-flat-button color="primary" routerLink="/players/new">Nuevo jugador</a>
        }
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Busqueda</mat-label>
            <input matInput formControlName="search">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo documento</mat-label>
            <input matInput formControlName="documentType">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Numero documento</mat-label>
            <input matInput formControlName="documentNumber">
          </mat-form-field>

          <mat-checkbox formControlName="activeOnly">Solo activos</mat-checkbox>
        </form>

        <div class="actions-row">
          <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
          <button mat-flat-button color="primary" type="button" (click)="load()">Buscar</button>
        </div>

        @if (loading()) {
          <app-loading-state label="Cargando jugadores e identificadores..." />
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
              <strong>No hay jugadores para estos filtros.</strong>
              <p class="muted">Ajusta la busqueda, revisa documento o incluye inactivos para encontrar registros historicos.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="rows()" class="w-100 visual-table">
                <ng-container matColumnDef="player">
                  <th mat-header-cell *matHeaderCellDef>Jugador</th>
                  <td mat-cell *matCellDef="let player">
                    <app-visual-identity
                      kind="player"
                      [label]="player.firstName + ' ' + player.lastName"
                      [shortLabel]="playerInitialSource(player)"
                      [meta]="'ID ' + player.id"
                    />
                  </td>
                </ng-container>

                <ng-container matColumnDef="document">
                  <th mat-header-cell *matHeaderCellDef>Documento</th>
                  <td mat-cell *matCellDef="let player">
                    <div class="stack-sm">
                      <strong>{{ player.documentType || 'Sin tipo' }}</strong>
                      <span class="muted">{{ player.documentNumber || 'Numero pendiente' }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="contact">
                  <th mat-header-cell *matHeaderCellDef>Contacto</th>
                  <td mat-cell *matCellDef="let player">
                    <div class="stack-sm">
                      <span>{{ player.email || 'Email pendiente' }}</span>
                      <span class="muted">{{ player.phone || 'Telefono pendiente' }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Estado</th>
                  <td mat-cell *matCellDef="let player">
                    <span class="chip-status" [class.active]="player.active" [class.inactive]="!player.active">
                      {{ player.active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let player">
                    @if (canManage()) {
                      <a mat-button [routerLink]="['/players', player.id, 'edit']">Editar</a>
                    }
                    @if (canDelete()) {
                      <button mat-button type="button" color="warn" (click)="remove(player)">Eliminar</button>
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly playersService = inject(PlayersService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly page = signal<PlayerPage | null>(null);
  protected readonly rows = signal<Player[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly canManage = computed(() => this.authorization.canManage('players'));
  protected readonly canDelete = computed(() => this.authorization.canDelete('players'));
  protected readonly displayedColumns = computed(() => {
    const columns = ['player', 'document', 'contact', 'status'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });
  protected readonly visualMetrics = computed<PlayerVisualMetric[]>(() => {
    const rows = this.rows();
    const activeCount = rows.filter((player) => player.active).length;
    const documentedCount = rows.filter((player) => player.documentNumber).length;
    const contactReadyCount = rows.filter((player) => player.email || player.phone).length;

    return [
      {
        label: 'Total filtrado',
        value: this.page()?.totalElements ?? 0,
        meta: 'Jugadores segun busqueda actual',
        accent: true
      },
      {
        label: 'Activos visibles',
        value: activeCount,
        meta: 'Disponibles para operacion'
      },
      {
        label: 'Con documento',
        value: documentedCount,
        meta: 'Identificacion visible'
      },
      {
        label: 'Con contacto',
        value: contactReadyCount,
        meta: 'Email o telefono registrado'
      }
    ];
  });

  protected readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    documentType: [''],
    documentNumber: [''],
    activeOnly: [true]
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);

    const filters = this.filtersForm.getRawValue();
    this.playersService
      .list({
        search: filters.search,
        documentType: filters.documentType,
        documentNumber: filters.documentNumber,
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
      search: '',
      documentType: '',
      documentNumber: '',
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

  protected remove(player: Player): void {
    if (!window.confirm(`Se eliminara el jugador "${player.firstName} ${player.lastName}". Esta accion no se puede deshacer.`)) {
      return;
    }

    this.loading.set(true);
    this.playersService
      .delete(player.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Jugador eliminado correctamente');
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected playerInitialSource(player: Player): string {
    return `${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`;
  }
}
