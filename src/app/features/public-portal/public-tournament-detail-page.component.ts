import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

import { ErrorMapper } from '../../core/error/error.mapper';
import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { CalendarSectionComponent } from './calendar-section.component';
import {
  PublicTournamentCalendar,
  PublicTournamentDetail,
  PublicTournamentResults,
  PublicTournamentStandings
} from './public-portal.models';
import { PublicPortalService } from './public-portal.service';
import { ResultsSectionComponent } from './results-section.component';
import { StandingsSectionComponent } from './standings-section.component';

type DetailMetric = {
  label: string;
  value: string | number;
  detail: string;
};

@Component({
  selector: 'app-public-tournament-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    LoadingStateComponent,
    CalendarSectionComponent,
    ResultsSectionComponent,
    StandingsSectionComponent
  ],
  template: `
    <section class="public-page">
      @if (loading()) {
        <section class="card public-card">
          <app-loading-state />
        </section>
      } @else if (errorMessage()) {
        <section class="card public-card">
          <div class="empty-state">
            <strong>No fue posible abrir el detalle publico.</strong>
            <p class="muted">{{ errorMessage() }}</p>
            <a class="text-link" routerLink="/portal/tournaments">Volver al listado</a>
          </div>
        </section>
      } @else if (tournament()) {
        <section class="hero-panel card">
          <div class="hero-copy">
            <div class="hero-row">
              <span class="sport-chip">{{ tournament()!.sportName }}</span>
              <span class="status-badge" [class]="statusClass(tournament()!.status)">
                {{ statusLabel(tournament()!.status) }}
              </span>
            </div>
            <h1>{{ tournament()!.name }}</h1>
            <p class="hero-summary">{{ tournament()!.description || 'Sin descripcion publica cargada.' }}</p>
            <div class="hero-actions">
              <a mat-stroked-button routerLink="/portal/tournaments">Volver al listado</a>
              <a mat-flat-button color="primary" routerLink="/portal">Inicio publico</a>
            </div>
          </div>

          <div class="hero-aside">
            <span class="meta-chip">{{ tournament()!.seasonName }}</span>
            <span class="meta-chip">{{ formatLabel(tournament()!.format) }}</span>
            <span class="meta-chip">Actualizado {{ dateTimeLabel(tournament()!.updatedAt) }}</span>
            <span class="meta-chip" [class.enabled]="tournament()!.modules.standingsEnabled">
              Standings {{ tournament()!.modules.standingsEnabled ? 'activos' : 'ocultos' }}
            </span>
            <span class="meta-chip" [class.enabled]="tournament()!.modules.resultsEnabled">
              Resultados {{ tournament()!.modules.resultsEnabled ? 'activos' : 'ocultos' }}
            </span>
            <span class="meta-chip muted-chip">
              Piezas aprobadas {{ tournament()!.modules.approvedPiecesEnabled ? 'activas' : 'deshabilitadas' }}
            </span>
          </div>
        </section>

        <section class="metrics-grid">
          @for (metric of metrics(); track metric.label) {
            <article class="summary-card card">
              <span class="summary-label">{{ metric.label }}</span>
              <span class="summary-value">{{ metric.value }}</span>
              <span class="summary-meta">{{ metric.detail }}</span>
            </article>
          }
        </section>

        <app-calendar-section [calendar]="calendar()" />
        <app-results-section [results]="results()" />
        <app-standings-section [standings]="standings()" />

        @if (!tournament()!.modules.approvedPiecesEnabled) {
          <section class="card public-card">
            <div class="context-banner">
              <strong>Piezas aprobadas fuera de alcance</strong>
              <p class="muted">
                Este bloque no abre feed editorial ni seccion de piezas publicas.
              </p>
            </div>
          </section>
        }
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
        min-width: 0;
        padding: 1.5rem;
        border-radius: 8px;
      }

      .hero-panel {
        display: grid;
        gap: 1.25rem;
        grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
        background: linear-gradient(135deg, rgba(10, 110, 90, 0.08), rgba(255, 255, 255, 0.96));
      }

      .hero-copy,
      .hero-aside,
      .results-grid,
      .result-card {
        display: grid;
        gap: 0.85rem;
      }

      .results-grid {
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      }

      .result-card {
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid rgba(23, 33, 43, 0.08);
        background: rgba(255, 255, 255, 0.78);
      }

      .scoreboard {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
      }

      .score-value {
        display: inline-flex;
        min-width: 4.5rem;
        justify-content: center;
        padding: 0.45rem 0.65rem;
        border-radius: 8px;
        background: rgba(10, 110, 90, 0.1);
        color: var(--primary);
      }

      .position-pill {
        display: inline-flex;
        width: 2rem;
        height: 2rem;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background: #e0f2fe;
        color: #075985;
        font-weight: 800;
      }

      .position-pill.leader {
        background: #fef3c7;
        color: #92400e;
      }

      .hero-row,
      .hero-actions,
      .section-heading,
      .card-head {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .section-heading {
        justify-content: space-between;
        margin-bottom: 1rem;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.05;
      }

      .hero-summary {
        color: var(--text-soft);
      }

      .metrics-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(23, 33, 43, 0.08);
      }

      .meta-chip.enabled,
      .sport-chip {
        color: var(--primary);
      }

      .muted-chip {
        color: var(--text-soft);
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

      .public-table {
        width: 100%;
        min-width: 620px;
        border-collapse: collapse;
      }

      .table-wrapper {
        max-width: 100%;
        overflow-x: auto;
      }

      .public-table th,
      .public-table td {
        padding: 0.8rem 0.75rem;
        border-bottom: 1px solid rgba(23, 33, 43, 0.08);
        text-align: left;
      }

      .text-link {
        color: var(--primary);
        font-weight: 700;
        text-decoration: none;
      }

      .summary-card {
        border-radius: 8px;
      }

      @media (max-width: 840px) {
        .hero-panel {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .public-card,
        .hero-panel {
          padding: 1rem;
        }

        .hero-actions,
        .section-heading {
          align-items: stretch;
          flex-direction: column;
        }

        .hero-actions a {
          width: 100%;
        }

        .scoreboard {
          grid-template-columns: 1fr;
        }

        .score-value {
          width: 100%;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentDetailComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly publicPortalService = inject(PublicPortalService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly loading = signal(true);
  protected readonly tournament = signal<PublicTournamentDetail | null>(null);
  protected readonly calendar = signal<PublicTournamentCalendar | null>(null);
  protected readonly standings = signal<PublicTournamentStandings | null>(null);
  protected readonly results = signal<PublicTournamentResults | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly metrics = computed<DetailMetric[]>(() => {
    const tournament = this.tournament();
    const standings = this.standings();
    const results = this.results();

    if (!tournament) {
      return [];
    }

    return [
      { label: 'Formato', value: this.formatLabel(tournament.format), detail: tournament.seasonName },
      { label: 'Fechas', value: this.dateRangeLabel(tournament.startDate, tournament.endDate), detail: 'Ventana publica visible' },
      { label: 'Entradas tabla', value: standings?.totalEntries ?? 0, detail: 'Equipos con standings visibles' },
      { label: 'Resultados cerrados', value: results?.totalClosedMatches ?? 0, detail: 'Partidos publicados' }
    ];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) {
        this.errorMessage.set('No se encontro el slug publico del torneo.');
        this.loading.set(false);
        return;
      }

      this.loadTournament(slug);
    });
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

  protected dateTimeLabel(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    return parsed
      ? new Intl.DateTimeFormat('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(parsed)
      : 'sin dato';
  }

  protected dateRangeLabel(startDate: string | null, endDate: string | null): string {
    const start = this.dateLabel(startDate);
    const end = this.dateLabel(endDate);
    return start && end ? `${start} - ${end}` : start || end || 'Fechas por confirmar';
  }

  private loadTournament(slug: string): void {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      tournament: this.publicPortalService.getTournament(slug),
      calendar: this.publicPortalService.getCalendar(slug),
      standings: this.publicPortalService.getStandings(slug),
      results: this.publicPortalService.getResults(slug)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tournament, calendar, standings, results }) => {
          this.tournament.set(tournament);
          this.calendar.set(calendar);
          this.standings.set(standings);
          this.results.set(results);
          this.updateMetadata(tournament);
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

  private updateMetadata(tournament: PublicTournamentDetail): void {
    this.title.setTitle(`${tournament.name} | Sistema Campeonatos`);
    this.meta.updateTag({
      name: 'description',
      content:
        tournament.description ||
        `${tournament.name} publica tablas y resultados visibles en Sistema Campeonatos.`
    });
  }
}
