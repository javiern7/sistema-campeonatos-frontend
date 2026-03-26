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
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Sport } from '../sports/sport.models';
import { SportsService } from '../sports/sports.service';
import { Tournament, TournamentPage, TournamentStatus } from './tournament.models';
import { TournamentsService } from './tournaments.service';

@Component({
  selector: 'app-tournament-list-page',
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
      <app-page-header title="Torneos" subtitle="Operacion de torneos conectada a /tournaments con lectura multideporte.">
        @if (canManage()) {
          <a mat-flat-button color="primary" routerLink="/tournaments/new">Nuevo torneo</a>
        }
      </app-page-header>

      <section class="card page-card app-page">
        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="name">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Deporte</mat-label>
            <mat-select formControlName="sportId">
              <mat-option value="">Todos</mat-option>
              @for (sport of sports(); track sport.id) {
                <mat-option [value]="sport.id">{{ sport.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
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
          <p class="muted">Total: {{ page()?.totalElements ?? 0 }}</p>

          <div class="table-wrapper">
            <table mat-table [dataSource]="rows()" class="w-100">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let row">{{ row.id }}</td>
              </ng-container>

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Torneo</th>
                <td mat-cell *matCellDef="let row">{{ row.name }}</td>
              </ng-container>

              <ng-container matColumnDef="sport">
                <th mat-header-cell *matHeaderCellDef>Deporte</th>
                <td mat-cell *matCellDef="let row">{{ sportName(row.sportId) }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">{{ row.status }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  @if (canManage()) {
                    <a mat-button [routerLink]="['/tournaments', row.id, 'edit']">Editar</a>
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
export class TournamentListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly sportsService = inject(SportsService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly page = signal<TournamentPage | null>(null);
  protected readonly rows = signal<Tournament[]>([]);
  protected readonly sports = signal<Sport[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly canManage = computed(() => this.authorization.canManage('tournaments'));
  protected readonly canDelete = computed(() => this.authorization.canDelete('tournaments'));
  protected readonly displayedColumns = computed(() => {
    const columns = ['id', 'name', 'sport', 'status'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });
  protected readonly statuses: TournamentStatus[] = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'];

  protected readonly filtersForm = this.fb.nonNullable.group({
    name: [''],
    sportId: [''],
    status: ['' as TournamentStatus | '']
  });

  constructor() {
    this.sportsService.list(false).subscribe({ next: (sports) => this.sports.set(sports) });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    this.tournamentsService
      .list({
        name: filters.name,
        sportId: filters.sportId ? Number(filters.sportId) : '',
        status: filters.status,
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
    this.filtersForm.setValue({ name: '', sportId: '', status: '' });
    this.pageIndex.set(0);
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected sportName(sportId: number): string {
    return this.sports().find((sport) => sport.id === sportId)?.name ?? `#${sportId}`;
  }

  protected remove(tournament: Tournament): void {
    if (!window.confirm(`Se eliminara el torneo "${tournament.name}". Esta accion no se puede deshacer.`)) {
      return;
    }

    this.loading.set(true);
    this.tournamentsService
      .delete(tournament.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Torneo eliminado correctamente');
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }
}
