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
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Tournament, TournamentStatus } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';

type TournamentModuleKey = 'competitionAdvanced' | 'statisticsBasic' | 'discipline';

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
  discipline: {
    title: 'Disciplina',
    subtitle: 'Incidencias y sanciones simples por torneo y partido.',
    banner: 'Selecciona un torneo para revisar su lectura disciplinaria acotada.',
    actionLabel: 'Abrir disciplina',
    path: (tournamentId) => `/tournaments/${tournamentId}/discipline`
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
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly moduleKey = signal<TournamentModuleKey>('competitionAdvanced');
  protected readonly moduleConfig = computed(() => MODULE_CONFIGS[this.moduleKey()]);
  protected readonly statuses: TournamentStatus[] = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'];
  protected readonly filtersForm = this.fb.nonNullable.group({
    name: [''],
    status: ['' as TournamentStatus | '']
  });

  constructor() {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.moduleKey.set((data['module'] as TournamentModuleKey | undefined) ?? 'competitionAdvanced');
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    const filters = this.filtersForm.getRawValue();

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
    this.filtersForm.setValue({ name: '', status: '' });
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
