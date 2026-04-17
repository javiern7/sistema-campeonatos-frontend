import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-reporting-hub',
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
      <app-page-header title="Reportes" subtitle="Reporteria operativa y exportacion simple desde datos consolidados.">
        <a mat-stroked-button routerLink="/tournaments">Ver torneos</a>
      </app-page-header>

      <section class="card page-card app-page">
        <div class="context-banner">
          <strong>Lectura operativa</strong>
          <span class="muted">Selecciona un torneo para consultar reportes sin recalcular standings ni modificar resultados.</span>
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
            <p class="muted">Ajusta la busqueda para abrir reportes operativos.</p>
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
                  <a mat-flat-button color="primary" [routerLink]="['/tournaments', tournament.id, 'reports']">
                    Abrir reportes
                  </a>
                  <a mat-button [routerLink]="['/tournaments', tournament.id]">Detalle</a>
                </div>
              </article>
            }
          </div>
        }
      </section>

      <section class="card page-card">
        <div class="section-heading">
          <div>
            <h2>Entradas disponibles</h2>
            <p class="muted">Pantallas actuales que alimentan reportes por contrato backend.</p>
          </div>
        </div>
        <div class="entry-grid">
          @for (entry of entries(); track entry.label) {
            <article class="entry-card">
              <strong>{{ entry.label }}</strong>
              <span class="muted">{{ entry.scope }}</span>
            </article>
          }
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      .module-grid,
      .entry-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .module-card,
      .entry-card {
        display: grid;
        gap: 0.65rem;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .module-card p,
      .section-heading h2,
      .section-heading p {
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
export class ReportingHubComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly tournamentOptions = signal<Tournament[]>([]);
  protected readonly statuses: TournamentStatus[] = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'];
  protected readonly entries = computed(() => [
    { label: 'Torneos', scope: 'Resumen, fuente y fecha de generacion.' },
    { label: 'Partidos', scope: 'Listado por torneo y rango operativo.' },
    { label: 'Tabla de posiciones', scope: 'Lectura oficial existente, sin recalculo.' },
    { label: 'Eventos', scope: 'Eventos de partido filtrables por equipo, jugador o partido.' },
    { label: 'Goleadores y tarjetas', scope: 'Estadisticas derivadas ya cerradas.' }
  ]);
  protected readonly filtersForm = this.fb.nonNullable.group({
    tournamentId: [0 as number | ''],
    name: [''],
    status: ['' as TournamentStatus | '']
  });

  constructor() {
    this.catalogLoader
      .loadAll((page, size) => this.tournamentsService.list({ page, size }))
      .subscribe({ next: (items) => this.tournamentOptions.set(items) });
    this.load();
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
      .list({ name: filters.name, status: filters.status, page: 0, size: 50 })
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
