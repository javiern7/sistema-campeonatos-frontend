import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { ErrorMapper } from '../../core/error/error.mapper';
import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PublicHome } from './public-portal.models';
import { PublicPortalService } from './public-portal.service';

type PublicMetric = {
  label: string;
  value: number;
  detail: string;
  accent?: boolean;
};

@Component({
  selector: 'app-public-home-page',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent],
  template: `
    <section class="public-page">
      @if (loading()) {
        <section class="card public-card">
          <div class="hero-copy">
            <span class="hero-kicker">Web publica</span>
            <h1>Cargando torneos visibles...</h1>
          </div>
          <app-loading-state />
        </section>
      } @else if (errorMessage()) {
        <section class="card public-card">
          <div class="empty-state">
            <strong>No fue posible cargar la home publica.</strong>
            <p class="muted">{{ errorMessage() }}</p>
            <a class="text-link" routerLink="/portal/tournaments">Ir al listado publico</a>
          </div>
        </section>
      } @else if (home()) {
        <section class="hero-panel card">
          <div class="hero-copy">
            <span class="hero-kicker">Web publica</span>
            <h1>{{ home()!.portalName }}</h1>
            <p class="hero-summary">
              Torneos, tablas y resultados visibles desde el contrato publico vigente.
            </p>
            <div class="hero-actions">
              <a class="primary-link" routerLink="/portal/tournaments">Explorar torneos</a>
              <a class="ghost-link" routerLink="/login">Acceso interno</a>
            </div>
          </div>

          <div class="hero-aside">
            <span class="meta-chip">Actualizado {{ generatedAtLabel() }}</span>
            <span class="meta-chip" [class.enabled]="home()!.modules.standingsEnabled">Standings visibles</span>
            <span class="meta-chip" [class.enabled]="home()!.modules.resultsEnabled">Resultados visibles</span>
            <span class="meta-chip muted-chip">
              Piezas aprobadas: {{ home()!.modules.approvedPiecesEnabled ? 'activas' : 'ocultas' }}
            </span>
          </div>
        </section>

        <section class="metrics-grid">
          @for (metric of metrics(); track metric.label) {
            <article class="summary-card card" [class.accent]="metric.accent">
              <span class="summary-label">{{ metric.label }}</span>
              <span class="summary-value">{{ metric.value }}</span>
              <span class="summary-meta">{{ metric.detail }}</span>
            </article>
          }
        </section>

        <section class="card public-card">
          <div class="section-heading">
            <div>
              <h2>Torneos destacados</h2>
              <p class="muted">Torneos publicados y listos para consulta externa.</p>
            </div>
            <a class="text-link" routerLink="/portal/tournaments">Ver todos</a>
          </div>

          @if (home()!.featuredTournaments.length) {
            <div class="tournament-grid">
              @for (tournament of home()!.featuredTournaments; track tournament.slug) {
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
                  <a class="text-link" [routerLink]="['/portal/tournaments', tournament.slug]">Ver detalle</a>
                </article>
              }
            </div>
          } @else {
            <div class="empty-state">
              <strong>No hay torneos destacados visibles.</strong>
              <p class="muted">La home publica se habilita cuando existen torneos visibles.</p>
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

      .public-card,
      .hero-panel {
        padding: 1.5rem;
        border-radius: 8px;
      }

      .hero-panel {
        display: grid;
        gap: 1.25rem;
        grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
        background: linear-gradient(135deg, rgba(10, 110, 90, 0.1), rgba(255, 255, 255, 0.96));
      }

      .hero-copy,
      .hero-aside {
        display: grid;
        gap: 0.9rem;
        align-content: start;
      }

      .hero-kicker {
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--primary);
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      h1 {
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 1.02;
      }

      .hero-summary {
        max-width: 58ch;
        color: var(--text-soft);
        font-size: 1.02rem;
      }

      .hero-actions,
      .section-heading,
      .card-head,
      .meta-grid {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .section-heading {
        justify-content: space-between;
        margin-bottom: 1rem;
      }

      .primary-link,
      .ghost-link,
      .text-link {
        text-decoration: none;
        font-weight: 700;
      }

      .primary-link,
      .ghost-link {
        padding: 0.8rem 1rem;
        border-radius: 8px;
      }

      .primary-link {
        background: var(--primary);
        color: #f8fffd;
      }

      .ghost-link {
        border: 1px solid rgba(10, 110, 90, 0.22);
        color: var(--primary);
      }

      .text-link {
        color: var(--primary);
      }

      .meta-chip,
      .sport-chip,
      .status-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.4rem 0.7rem;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .meta-chip,
      .sport-chip {
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(23, 33, 43, 0.08);
      }

      .meta-chip.enabled {
        background: rgba(10, 110, 90, 0.1);
        color: var(--primary);
      }

      .muted-chip {
        color: var(--text-soft);
      }

      .metrics-grid,
      .tournament-grid {
        display: grid;
        gap: 1rem;
      }

      .metrics-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .tournament-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .tournament-card {
        display: grid;
        gap: 0.8rem;
        padding: 1.1rem;
        border-radius: 8px;
        border: 1px solid rgba(23, 33, 43, 0.08);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(238, 242, 246, 0.64));
      }

      .meta-grid {
        color: var(--text-soft);
        font-size: 0.9rem;
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

      .summary-card {
        border-radius: 8px;
      }

      @media (max-width: 840px) {
        .hero-panel {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 560px) {
        .public-card,
        .hero-panel {
          padding: 1rem;
        }

        .section-heading,
        .hero-actions {
          align-items: stretch;
          flex-direction: column;
        }

        .primary-link,
        .ghost-link,
        .text-link {
          width: 100%;
          text-align: center;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicHomePageComponent {
  private readonly publicPortalService = inject(PublicPortalService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly loading = signal(true);
  protected readonly home = signal<PublicHome | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly metrics = computed<PublicMetric[]>(() => {
    const home = this.home();
    if (!home) {
      return [];
    }

    return [
      { label: 'Torneos visibles', value: home.visibleTournamentCount, detail: 'Base publica disponible', accent: true },
      { label: 'En curso', value: home.liveTournamentCount, detail: 'Actividad en vivo o activa' },
      { label: 'Proximos', value: home.upcomingTournamentCount, detail: 'Listos para abrir' },
      { label: 'Finalizados', value: home.completedTournamentCount, detail: 'Con lectura historica' }
    ];
  });

  constructor() {
    this.publicPortalService
      .getHome()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (home) => {
          this.home.set(home);
          this.updateMetadata(home);
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(this.errorMapper.map(error).message);
          this.loading.set(false);
        }
      });
  }

  protected generatedAtLabel(): string {
    return this.dateLabel(this.home()?.generatedAt ?? null);
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

  private dateLabel(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    return parsed
      ? new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
      : '';
  }

  private updateMetadata(home: PublicHome): void {
    this.title.setTitle(`${home.portalName} | Torneos publicos`);
    this.meta.updateTag({
      name: 'description',
      content: 'Torneos, tablas y resultados visibles desde el contrato publico vigente de Sistema Campeonatos.'
    });
  }
}
