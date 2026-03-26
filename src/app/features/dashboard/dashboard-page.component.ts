import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { finalize } from 'rxjs';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { TournamentStatus } from '../tournaments/tournament.models';
import {
  DashboardAlert,
  DashboardHealth,
  DashboardSportSummary,
  DashboardSummary,
  DashboardTournamentSummary
} from './dashboard.models';
import { DashboardService } from './dashboard.service';

type DashboardCard = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [MatCardModule, PageHeaderComponent, LoadingStateComponent],
  template: `
    <section class="app-page">
      <app-page-header
        title="Dashboard Ejecutivo"
        subtitle="Reporting transversal del estado multideporte, la cobertura operativa y los torneos que necesitan accion."
      />

      @if (loading()) {
        <app-loading-state />
      } @else {
        <div class="context-banner">
          <strong>Resumen transversal del sistema</strong>
          <span class="muted">{{ healthMessage() }}</span>
        </div>

        <div class="summary-grid">
          @for (card of overviewCards(); track card.label) {
            <mat-card class="summary-card card" [class.accent]="card.accent">
              <span class="summary-label">{{ card.label }}</span>
              <span class="summary-value">{{ card.value }}</span>
              <span class="summary-meta">{{ card.meta }}</span>
            </mat-card>
          }
        </div>

        <div class="summary-grid">
          @for (card of operationCards(); track card.label) {
            <mat-card class="summary-card card">
              <span class="summary-label">{{ card.label }}</span>
              <span class="summary-value">{{ card.value }}</span>
              <span class="summary-meta">{{ card.meta }}</span>
            </mat-card>
          }
        </div>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Alertas prioritarias</h2>
              <p class="muted">Torneos que conviene atender primero para no perder continuidad operativa.</p>
            </div>
            <span class="section-badge">{{ alerts().length }} abiertas</span>
          </div>

          @if (alerts().length === 0) {
            <div class="empty-state">
              <strong>No hay alertas operativas prioritarias.</strong>
              <p class="muted">La cartera actual mantiene trazabilidad visible en los torneos cargados.</p>
            </div>
          } @else {
            <div class="alert-grid">
              @for (alert of alerts(); track alert.tournamentId) {
                <article class="alert-card card">
                  <div class="alert-header">
                    <span class="health-pill" [class]="healthClass(alert.health)">{{ healthLabel(alert.health) }}</span>
                    <span class="muted">{{ alert.sportName }}</span>
                  </div>
                  <strong>{{ alert.title }}</strong>
                  <p class="muted">{{ alert.detail }}</p>
                </article>
              }
            </div>
          }
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Radar por deporte</h2>
              <p class="muted">Lectura ejecutiva para detectar dónde ya hay operación madura y dónde aún falta cerrar el flujo.</p>
            </div>
          </div>

          <div class="sport-grid">
            @for (sport of sportSummaries(); track sport.sportId) {
              <article class="sport-card card">
                <div class="alert-header">
                  <strong>{{ sport.sportName }}</strong>
                  <span class="health-pill" [class]="healthClass(sport.health)">{{ healthLabel(sport.health) }}</span>
                </div>
                <p class="muted">{{ sport.healthMessage }}</p>
                <div class="mini-metrics">
                  <span>Torneos: {{ sport.tournamentCount }}</span>
                  <span>En curso: {{ sport.liveTournamentCount }}</span>
                  <span>Inscripciones aprobadas: {{ sport.approvedRegistrationCount }}</span>
                  <span>Rosters activos: {{ sport.activeRosterCount }}</span>
                  <span>Partidos jugados: {{ sport.playedMatchCount }}/{{ sport.matchCount }}</span>
                  <span>Standings: {{ sport.standingsCount }}</span>
                </div>
              </article>
            }
          </div>
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Seguimiento por torneo</h2>
              <p class="muted">Backlog operativo visible para decidir el siguiente bloque funcional con bajo riesgo.</p>
            </div>
            <span class="section-badge">{{ tournamentSummaries().length }} torneos</span>
          </div>

          @if (tournamentSummaries().length === 0) {
            <div class="empty-state">
              <strong>No hay torneos registrados.</strong>
              <p class="muted">Crear un torneo sigue siendo el punto de arranque para activar la capa multideporte.</p>
            </div>
          } @else {
            <div class="tournament-grid">
              @for (tournament of tournamentSummaries(); track tournament.tournamentId) {
                <article class="tournament-card card">
                  <div class="alert-header">
                    <div class="stack-sm">
                      <strong>{{ tournament.tournamentName }}</strong>
                      <span class="muted">{{ tournament.sportName }} · {{ statusLabel(tournament.status) }}</span>
                    </div>
                    <span class="health-pill" [class]="healthClass(tournament.health)">{{ healthLabel(tournament.health) }}</span>
                  </div>

                  <div class="mini-metrics">
                    <span>Etapas: {{ tournament.stageCount }}</span>
                    <span>Grupos: {{ tournament.groupCount }}</span>
                    <span>Inscripciones: {{ tournament.registrationCount }}</span>
                    <span>Rosters activos: {{ tournament.activeRosterCount }}</span>
                    <span>Partidos: {{ tournament.playedMatchCount }}/{{ tournament.matchCount }} jugados</span>
                    <span>Incidencias: {{ tournament.incidentMatchCount }}</span>
                    <span>Standings: {{ tournament.standingsCount }}</span>
                    <span>Lider: {{ leaderLabel(tournament) }}</span>
                  </div>

                  <p class="muted">{{ tournament.nextAction }}</p>
                </article>
              }
            </div>
          }
        </section>
      }
    </section>
  `,
  styles: [
    `
      .section-heading {
        display: flex;
        gap: 1rem;
        align-items: start;
        justify-content: space-between;
      }

      .section-heading h2 {
        margin: 0;
        font-size: 1.1rem;
      }

      .section-heading p {
        margin: 0.35rem 0 0;
      }

      .section-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.4rem 0.75rem;
        border-radius: 999px;
        background: var(--surface-alt);
        color: var(--text-soft);
        font-size: 0.85rem;
        font-weight: 600;
      }

      .alert-grid,
      .sport-grid,
      .tournament-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .alert-card,
      .sport-card,
      .tournament-card {
        display: grid;
        gap: 0.85rem;
        padding: 1rem 1.1rem;
      }

      .alert-card p,
      .sport-card p,
      .tournament-card p {
        margin: 0;
      }

      .alert-header {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        justify-content: space-between;
      }

      .health-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
      }

      .health-pill.healthy {
        background: #dcfce7;
        color: #166534;
      }

      .health-pill.warning {
        background: #fef3c7;
        color: #92400e;
      }

      .health-pill.attention {
        background: #fee2e2;
        color: #b91c1c;
      }

      .mini-metrics {
        display: grid;
        gap: 0.55rem;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        color: var(--text-soft);
        font-size: 0.88rem;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly overviewCards = computed<DashboardCard[]>(() => {
    const summary = this.summary();

    return [
      {
        label: 'Deportes',
        value: summary?.sportCount ?? 0,
        meta: 'Catalogo base activo'
      },
      {
        label: 'Torneos',
        value: summary?.tournamentCount ?? 0,
        meta: `${summary?.activeTournamentCount ?? 0} abiertos o en curso`,
        accent: true
      },
      {
        label: 'Equipos',
        value: summary?.teamCount ?? 0,
        meta: 'Equipos disponibles'
      },
      {
        label: 'Jugadores',
        value: summary?.playerCount ?? 0,
        meta: 'Jugadores cargados'
      }
    ];
  });
  protected readonly operationCards = computed<DashboardCard[]>(() => {
    const summary = this.summary();

    return [
      {
        label: 'Inscripciones',
        value: summary?.registrationCount ?? 0,
        meta: `${summary?.approvedRegistrationCount ?? 0} aprobadas`
      },
      {
        label: 'Rosters activos',
        value: summary?.activeRosterCount ?? 0,
        meta: 'Jugadores habilitados hoy'
      },
      {
        label: 'Partidos jugados',
        value: summary?.playedMatchCount ?? 0,
        meta: `${summary?.scheduledMatchCount ?? 0} programados por disputar`
      },
      {
        label: 'Standings',
        value: summary?.standingsCount ?? 0,
        meta: 'Registros de tabla generados'
      },
      {
        label: 'Torneos con alerta',
        value: summary?.attentionTournamentCount ?? 0,
        meta: 'Requieren seguimiento ejecutivo'
      }
    ];
  });
  protected readonly alerts = computed<DashboardAlert[]>(() => this.summary()?.alerts ?? []);
  protected readonly sportSummaries = computed<DashboardSportSummary[]>(() => this.summary()?.sportSummaries ?? []);
  protected readonly tournamentSummaries = computed<DashboardTournamentSummary[]>(
    () => this.summary()?.tournamentSummaries ?? []
  );
  protected readonly healthMessage = computed(() => {
    const summary = this.summary();
    if (!summary) {
      return '';
    }

    if (summary.tournamentCount === 0) {
      return 'No hay torneos cargados. El siguiente paso operativo es crear una competencia para activar el flujo multideporte.';
    }

    if (summary.attentionTournamentCount > 0) {
      return `Hay ${summary.attentionTournamentCount} torneos con alertas operativas. Sprint 5 puede enfocarse en cerrar esas brechas sin abrir frentes nuevos.`;
    }

    if (summary.registrationCount === 0) {
      return 'Hay torneos pero aun no existen inscripciones. Conviene continuar por Inscripciones para poblar la operacion.';
    }

    if (summary.matchCount === 0) {
      return 'La base competitiva ya existe, pero falta programar partidos para comenzar a generar resultados y standings.';
    }

    return 'La base operativa ya permite seguir el flujo torneo -> inscripciones -> rosters -> partidos -> standings con una vista ejecutiva transversal.';
  });

  constructor() {
    this.dashboardService
      .getSummary()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected healthLabel(health: DashboardHealth): string {
    const labels: Record<DashboardHealth, string> = {
      healthy: 'Estable',
      warning: 'Seguimiento',
      attention: 'Prioridad'
    };

    return labels[health];
  }

  protected healthClass(health: DashboardHealth): string {
    return health;
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

  protected leaderLabel(tournament: DashboardTournamentSummary): string {
    if (!tournament.leaderName) {
      return 'Sin tabla visible';
    }

    return `${tournament.leaderName} (${tournament.leaderPoints ?? 0} pts)`;
  }
}
