import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ErrorMapper } from '../../core/error/error.mapper';
import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PublicTournamentStatus, PublicTournamentSummary } from './public-portal.models';
import { PublicPortalService } from './public-portal.service';

type FilterState = {
  name: string;
  status: PublicTournamentStatus | '';
};

@Component({
  selector: 'app-public-tournament-list-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    LoadingStateComponent
  ],
  template: `
    <section class="public-page">
      <section class="card public-card">
        <div class="section-heading">
          <div>
            <span class="hero-kicker">Listado publico</span>
            <h1>Torneos visibles</h1>
            <p class="muted">Fuente oficial: \`GET /api/public/tournaments\`, sin semantica paralela ni shell autenticado.</p>
          </div>
          <a mat-stroked-button routerLink="/portal">Volver al inicio</a>
        </div>

        <form class="filter-row" (ngSubmit)="applyFilters()">
          <mat-form-field appearance="outline">
            <mat-label>Buscar por nombre</mat-label>
            <input matInput [(ngModel)]="draftFilters.name" name="name" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select [(ngModel)]="draftFilters.status" name="status">
              <mat-option value="">Todos</mat-option>
              <mat-option value="OPEN">Abierto</mat-option>
              <mat-option value="IN_PROGRESS">En curso</mat-option>
              <mat-option value="FINISHED">Finalizado</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="actions-row">
            <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
            <button mat-flat-button color="primary" type="submit">Aplicar</button>
          </div>
        </form>
      </section>

      @if (loading()) {
        <section class="card public-card">
          <app-loading-state />
        </section>
      } @else if (errorMessage()) {
        <section class="card public-card">
          <div class="empty-state">
            <strong>No fue posible obtener el listado publico.</strong>
            <p class="muted">{{ errorMessage() }}</p>
          </div>
        </section>
      } @else {
        <section class="card public-card">
          <div class="section-heading">
            <div>
              <h2>{{ totalLabel() }}</h2>
              <p class="muted">Solo se listan torneos \`PRODUCTION\` en estados publicos aprobados.</p>
            </div>
          </div>

          @if (tournaments().length) {
            <div class="tournament-grid">
              @for (tournament of tournaments(); track tournament.slug) {
                <article class="tournament-card">
                  <div class="card-head">
                    <span class="sport-chip">{{ tournament.sportName }}</span>
                    <span class="status-badge" [class]="statusClass(tournament.status)">
                      {{ statusLabel(tournament.status) }}
                    </span>
                  </div>
                  <h3>{{ tournament.name }}</h3>
                  <p class="muted">{{ tournament.description || 'Sin descripcion publica cargada.' }}</p>
                  <div class="meta-grid">
                    <span>{{ tournament.seasonName }}</span>
                    <span>{{ formatLabel(tournament.format) }}</span>
                    <span>{{ dateRangeLabel(tournament.startDate, tournament.endDate) }}</span>
                  </div>
                  <a class="text-link" [routerLink]="['/portal/tournaments', tournament.slug]">Abrir detalle publico</a>
                </article>
              }
            </div>
          } @else {
            <div class="empty-state">
              <strong>No hay torneos visibles con esos filtros.</strong>
              <p class="muted">Ajusta nombre o estado sin inventar reglas nuevas de publicacion.</p>
            </div>
          }
        </section>
      }
    </section>
  `,
  styles: [
    `
      .public-page {
        display: grid;
        gap: 1rem;
      }

      .public-card {
        padding: 1.5rem;
      }

      .section-heading,
      .meta-grid,
      .card-head {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      .hero-kicker {
        display: inline-block;
        margin-bottom: 0.35rem;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--primary);
      }

      .tournament-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      }

      .tournament-card {
        display: grid;
        gap: 0.8rem;
        padding: 1.1rem;
        border-radius: 18px;
        border: 1px solid rgba(23, 33, 43, 0.08);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(238, 242, 246, 0.62));
      }

      .sport-chip,
      .status-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.4rem 0.7rem;
        border-radius: 999px;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .sport-chip {
        background: rgba(10, 110, 90, 0.08);
        color: var(--primary);
      }

      .status-badge.open {
        background: #e0f2fe;
        color: #075985;
      }

      .status-badge.in-progress {
        background: #dcfce7;
        color: #166534;
      }

      .status-badge.finished {
        background: #f3e8ff;
        color: #7c3aed;
      }

      .text-link {
        color: var(--primary);
        font-weight: 700;
        text-decoration: none;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicTournamentListPageComponent {
  private readonly publicPortalService = inject(PublicPortalService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly tournaments = signal<PublicTournamentSummary[]>([]);
  protected readonly totalElements = signal(0);
  protected readonly errorMessage = signal('');
  protected readonly totalLabel = computed(() => `Total visible: ${this.totalElements()}`);
  protected readonly draftFilters: FilterState = {
    name: '',
    status: ''
  };

  constructor() {
    this.loadTournaments();
  }

  protected applyFilters(): void {
    this.loadTournaments();
  }

  protected resetFilters(): void {
    this.draftFilters.name = '';
    this.draftFilters.status = '';
    this.loadTournaments();
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En curso',
      FINISHED: 'Finalizado'
    };

    return labels[status] ?? status;
  }

  protected statusClass(status: string): string {
    return status.toLowerCase().replace('_', '-');
  }

  protected formatLabel(format: string): string {
    const labels: Record<string, string> = {
      LEAGUE: 'Liga',
      GROUPS_THEN_KNOCKOUT: 'Grupos + eliminacion',
      KNOCKOUT: 'Eliminacion'
    };

    return labels[format] ?? format;
  }

  protected dateRangeLabel(startDate: string | null, endDate: string | null): string {
    const start = this.dateLabel(startDate);
    const end = this.dateLabel(endDate);
    return start && end ? `${start} - ${end}` : start || end || 'Fechas por confirmar';
  }

  private loadTournaments(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.publicPortalService
      .listTournaments({
        name: this.draftFilters.name,
        status: this.draftFilters.status,
        page: 0,
        size: 12,
        sort: 'startDate,asc'
      })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (response) => {
          this.tournaments.set(response.content);
          this.totalElements.set(response.totalElements);
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(this.errorMapper.map(error).message);
          this.loading.set(false);
        }
      });
  }

  private dateLabel(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    return parsed
      ? new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
      : '';
  }
}
