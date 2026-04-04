import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import {
  TournamentTeam,
  TournamentTeamPage,
  TournamentTeamRegistrationStatus
} from './tournament-team.models';
import { TournamentTeamsService } from './tournament-teams.service';

type SummaryCard = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

@Component({
  selector: 'app-tournament-team-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Inscripciones" subtitle="Relacion operativa entre torneo y equipo.">
        @if (canManage()) {
          <a mat-flat-button color="primary" routerLink="/tournament-teams/new">Nueva inscripcion</a>
        }
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
            <mat-label>Equipo</mat-label>
            <mat-select formControlName="teamId">
              <mat-option value="">Todos</mat-option>
              @for (item of teams(); track item.id) {
                <mat-option [value]="item.id">{{ item.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="registrationStatus">
              <mat-option value="">Todos</mat-option>
              @for (status of statuses; track status) {
                <mat-option [value]="status">{{ statusLabel(status) }}</mat-option>
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
          <div class="context-banner">
            <strong>{{ selectedContextLabel() }}</strong>
            <span class="muted">Total filtrado: {{ page()?.totalElements ?? 0 }} inscripciones</span>
          </div>

          <div class="summary-grid">
            @for (card of summaryCards(); track card.label) {
              <article class="summary-card card" [class.accent]="card.accent">
                <span class="summary-label">{{ card.label }}</span>
                <span class="summary-value">{{ card.value }}</span>
                <span class="summary-meta">{{ card.meta }}</span>
              </article>
            }
          </div>

          @if (rows().length === 0) {
            <div class="empty-state">
              <strong>No hay inscripciones para este filtro.</strong>
              <p class="muted">Ajusta el contexto o registra una nueva inscripcion para habilitar rosters, partidos y standings.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="rows()" class="w-100">
                <ng-container matColumnDef="tournament">
                  <th mat-header-cell *matHeaderCellDef>Torneo</th>
                  <td mat-cell *matCellDef="let row">{{ tournamentName(row.tournamentId) }}</td>
                </ng-container>
                <ng-container matColumnDef="team">
                  <th mat-header-cell *matHeaderCellDef>Equipo</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <strong>{{ teamName(row.teamId) }}</strong>
                      <span class="muted">Inscripcion #{{ row.id }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="seeding">
                  <th mat-header-cell *matHeaderCellDef>Siembra</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <span>{{ row.seedNumber ?? '-' }}</span>
                      <span class="muted">Sorteo: {{ row.groupDrawPosition ?? '-' }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Estado</th>
                  <td mat-cell *matCellDef="let row">
                    <span [class]="statusClass(row.registrationStatus)">{{ statusLabel(row.registrationStatus) }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let row">
                    @if (canManage()) {
                      <a mat-button [routerLink]="['/tournament-teams', row.id, 'edit']">Editar</a>
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
export class TournamentTeamListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly page = signal<TournamentTeamPage | null>(null);
  protected readonly rows = signal<TournamentTeam[]>([]);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly statuses: TournamentTeamRegistrationStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
  protected readonly canManage = computed(() => this.authorization.canManage('tournamentTeams'));
  protected readonly canDelete = computed(() => this.authorization.canDelete('tournamentTeams'));
  protected readonly selectedContextLabel = computed(() => {
    const filters = this.filtersForm.getRawValue();
    const labels = [
      this.tournamentName(Number(filters.tournamentId)),
      this.teamName(Number(filters.teamId)),
      this.statusLabel(filters.registrationStatus)
    ].filter((label) => Boolean(label));

    return labels.length > 0 ? labels.join(' / ') : 'Todas las inscripciones';
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const rows = this.rows();
    const approved = rows.filter((item) => item.registrationStatus === 'APPROVED').length;
    const pending = rows.filter((item) => item.registrationStatus === 'PENDING').length;

    return [
      {
        label: 'Contexto activo',
        value: this.page()?.totalElements ?? 0,
        meta: this.selectedContextLabel(),
        accent: true
      },
      {
        label: 'Aprobadas en pagina',
        value: approved,
        meta: 'Listas para operar'
      },
      {
        label: 'Pendientes en pagina',
        value: pending,
        meta: 'Pendientes de decision'
      }
    ];
  });
  protected readonly displayedColumns = computed(() => {
    const columns = ['tournament', 'team', 'seeding', 'status'];
    if (this.canManage() || this.canDelete()) {
      columns.push('actions');
    }
    return columns;
  });
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [''],
    teamId: [''],
    registrationStatus: ['' as TournamentTeamRegistrationStatus | '']
  });

  constructor() {
    const queryParams = this.route.snapshot.queryParamMap;
    this.filtersForm.patchValue({
      tournamentId: queryParams.get('tournamentId') ?? '',
      teamId: queryParams.get('teamId') ?? '',
      registrationStatus: (queryParams.get('registrationStatus') as TournamentTeamRegistrationStatus | null) ?? ''
    });

    this.catalogLoader
      .loadAll((page, size) => this.tournamentsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournaments.set(items) });
    this.catalogLoader
      .loadAll((page, size) => this.teamsService.list({ page, size }))
      .subscribe({ next: (items) => this.teams.set(items) });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    this.tournamentTeamsService
      .list({
        tournamentId: filters.tournamentId ? Number(filters.tournamentId) : '',
        teamId: filters.teamId ? Number(filters.teamId) : '',
        registrationStatus: filters.registrationStatus,
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
    this.filtersForm.setValue({ tournamentId: '', teamId: '', registrationStatus: '' });
    this.pageIndex.set(0);
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected tournamentName(id: number): string {
    if (!id) {
      return '';
    }

    return this.tournaments().find((item) => item.id === id)?.name ?? `Torneo ${id}`;
  }

  protected teamName(id: number): string {
    if (!id) {
      return '';
    }

    return this.teams().find((item) => item.id === id)?.name ?? `Equipo ${id}`;
  }

  protected statusLabel(status: TournamentTeamRegistrationStatus | ''): string {
    const labels: Record<TournamentTeamRegistrationStatus, string> = {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      WITHDRAWN: 'Retirada'
    };

    return status ? labels[status] : '';
  }

  protected statusClass(status: TournamentTeamRegistrationStatus): string {
    const statusMap: Record<TournamentTeamRegistrationStatus, string> = {
      PENDING: 'status-pill scheduled',
      APPROVED: 'status-pill played',
      REJECTED: 'status-pill cancelled',
      WITHDRAWN: 'status-pill forfeit'
    };

    return statusMap[status];
  }

  protected remove(row: TournamentTeam): void {
    if (!window.confirm(`Se eliminara la inscripcion #${row.id}. Esta accion no se puede deshacer.`)) {
      return;
    }

    this.loading.set(true);
    this.tournamentTeamsService
      .delete(row.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Inscripcion eliminada correctamente');
          this.load();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }
}
