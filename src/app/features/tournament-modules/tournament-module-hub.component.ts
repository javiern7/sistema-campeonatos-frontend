import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Tournament, TournamentStatus } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';

type TournamentModuleKey =
  | 'competitionAdvanced'
  | 'statisticsBasic'
  | 'eventStatistics'
  | 'discipline'
  | 'financesBasic';

type TournamentModuleConfig = {
  title: string;
  subtitle: string;
  banner: string;
  actionLabel: string;
  path: (tournamentId: number) => string;
};

const MODULE_CONFIGS: Record<TournamentModuleKey, TournamentModuleConfig> = {
  competitionAdvanced: {
    title: 'Competencia avanzada',
    subtitle: 'Llaves, grupos y continuidad competitiva por torneo.',
    banner: 'Selecciona un torneo para revisar su estructura competitiva avanzada.',
    actionLabel: 'Abrir competencia',
    path: (tournamentId) => `/tournaments/${tournamentId}/competition-advanced`
  },
  statisticsBasic: {
    title: 'Estadisticas basicas',
    subtitle: 'Resumen, lideres simples y trazabilidad del torneo.',
    banner: 'Selecciona un torneo para revisar sus metricas basicas consolidadas.',
    actionLabel: 'Abrir estadisticas',
    path: (tournamentId) => `/tournaments/${tournamentId}/statistics/basic`
  },
  eventStatistics: {
    title: 'Estadisticas por eventos',
    subtitle: 'Goleadores, tarjetas y resumenes read-only desde eventos.',
    banner: 'Selecciona un torneo para revisar sus estadisticas derivadas de eventos activos.',
    actionLabel: 'Abrir estadisticas',
    path: (tournamentId) => `/tournaments/${tournamentId}/statistics/events`
  },
  discipline: {
    title: 'Disciplina',
    subtitle: 'Incidencias y sanciones simples por torneo y partido.',
    banner: 'Selecciona un torneo para revisar su lectura disciplinaria acotada.',
    actionLabel: 'Abrir disciplina',
    path: (tournamentId) => `/tournaments/${tournamentId}/discipline`
  },
  financesBasic: {
    title: 'Finanzas basicas',
    subtitle: 'Ingresos, gastos y balance operativo simple por torneo.',
    banner: 'Selecciona un torneo para revisar su lectura financiera acotada.',
    actionLabel: 'Abrir finanzas',
    path: (tournamentId) => `/tournaments/${tournamentId}/finances/basic`
  }
};

@Component({
  selector: 'app-tournament-module-hub',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header [title]="moduleConfig().title" [subtitle]="moduleConfig().subtitle">
        <a mat-stroked-button routerLink="/tournaments">Ver torneos</a>
      </app-page-header>

      <section class="card page-card app-page">
        <div class="context-banner">
          <strong>{{ moduleConfig().title }}</strong>
          <span class="muted">{{ moduleConfig().banner }}</span>
        </div>

        <form [formGroup]="filtersForm" class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Torneo</mat-label>
            <mat-select formControlName="tournamentId">
              <mat-option value="">Todos</mat-option>
              @for (tournament of tournamentOptions(); track tournament.id) {
                <mat-option [value]="tournament.id">{{ tournament.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Buscar torneo</mat-label>
            <input matInput formControlName="name">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="status">
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
          <app-loading-state label="Cargando torneos..." />
        } @else if (tournaments().length === 0) {
          <div class="empty-state">
            <strong>No hay torneos para este filtro.</strong>
            <p class="muted">Ajusta la busqueda o vuelve al listado general de torneos.</p>
          </div>
        } @else {
          <div class="module-grid">
            @for (tournament of tournaments(); track tournament.id) {
              <article class="module-card">
                <div class="module-card-head">
                  <strong>{{ tournament.name }}</strong>
                  <span [class]="statusClass(tournament.status)">{{ statusLabel(tournament.status) }}</span>
                </div>
                <span class="muted">{{ tournament.seasonName || 'Temporada sin etiqueta' }}</span>
                <p class="muted">{{ tournament.description || 'Sin descripcion operativa cargada.' }}</p>
                <div class="module-actions">
                  <a mat-flat-button color="primary" [routerLink]="modulePath(tournament.id)">{{ moduleConfig().actionLabel }}</a>
                  <a mat-button [routerLink]="['/tournaments', tournament.id]">Detalle</a>
                </div>
              </article>
            }
          </div>
        }
      </section>
    </section>
  `,
  styles: [
    `
      .module-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .module-card {
        display: grid;
        gap: 0.65rem;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .module-card p {
        margin: 0;
      }

      .module-card-head,
      .module-actions {
        display: flex;
        gap: 0.75rem;
        align-items: start;
        justify-content: space-between;
      }

      .module-actions {
        flex-wrap: wrap;
        justify-content: flex-start;
      }

      @media (max-width: 720px) {
        .module-card-head {
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentModuleHubComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly tournamentOptions = signal<Tournament[]>([]);
  protected readonly moduleKey = signal<TournamentModuleKey>('competitionAdvanced');
  protected readonly moduleConfig = computed(() => MODULE_CONFIGS[this.moduleKey()]);
  protected readonly statuses: TournamentStatus[] = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'];
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [0 as number | ''],
    name: [''],
    status: ['' as TournamentStatus | '']
  });

  constructor() {
    this.catalogLoader
      .loadAll((page, size) => this.tournamentsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournamentOptions.set(items) });

    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.moduleKey.set((data['module'] as TournamentModuleKey | undefined) ?? 'competitionAdvanced');
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

    if (filters.tournamentId) {
      this.tournamentsService
        .getById(Number(filters.tournamentId))
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (tournament) => this.tournaments.set([tournament]),
          error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
        });
      return;
    }

    this.tournamentsService
      .list({
        name: filters.name,
        status: filters.status,
        page: 0,
        size: 50
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => this.tournaments.set(page.content),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ tournamentId: '', name: '', status: '' });
    this.load();
  }

  protected modulePath(tournamentId: number): string {
    return this.moduleConfig().path(tournamentId);
  }

  protected statusLabel(status: TournamentStatus): string {
    const labels: Record<TournamentStatus, string> = {
      DRAFT: 'Borrador',
      OPEN: 'Abierto',
      IN_PROGRESS: 'En curso',
      FINISHED: 'Finalizado',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  protected statusClass(status: TournamentStatus): string {
    const statusMap: Record<TournamentStatus, string> = {
      DRAFT: 'status-pill scheduled',
      OPEN: 'status-pill scheduled',
      IN_PROGRESS: 'status-pill played',
      FINISHED: 'status-pill played',
      CANCELLED: 'status-pill cancelled'
    };

    return statusMap[status];
  }
}
