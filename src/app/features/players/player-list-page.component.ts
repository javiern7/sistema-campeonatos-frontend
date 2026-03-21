import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Player, PlayerPage } from './player.models';
import { PlayersService } from './players.service';

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
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header
        title="Players"
        subtitle="Listado operativo conectado al endpoint /players con búsqueda y filtros mínimos."
      >
        <a mat-flat-button color="primary" routerLink="/players/new">Nuevo jugador</a>
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Búsqueda</mat-label>
            <input matInput formControlName="search">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo documento</mat-label>
            <input matInput formControlName="documentType">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Número documento</mat-label>
            <input matInput formControlName="documentNumber">
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
                <td mat-cell *matCellDef="let player">{{ player.id }}</td>
              </ng-container>

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let player">{{ player.firstName }} {{ player.lastName }}</td>
              </ng-container>

              <ng-container matColumnDef="document">
                <th mat-header-cell *matHeaderCellDef>Documento</th>
                <td mat-cell *matCellDef="let player">
                  {{ player.documentType || '-' }} {{ player.documentNumber || '' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let player">
                  <span class="chip-status" [class.active]="player.active" [class.inactive]="!player.active">
                    {{ player.active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let player">
                  <a mat-button [routerLink]="['/players', player.id, 'edit']">Editar</a>
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
export class PlayerListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly playersService = inject(PlayersService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly page = signal<PlayerPage | null>(null);
  protected readonly rows = signal<Player[]>([]);
  protected readonly displayedColumns = ['id', 'name', 'document', 'status', 'actions'];

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
        page: 0,
        size: 20
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
    this.load();
  }
}
