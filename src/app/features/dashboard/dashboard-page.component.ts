import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { MatCardModule } from '@angular/material/card';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { DashboardSummary } from './dashboard.models';
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
        title="Dashboard"
        subtitle="Vista ejecutiva del estado operativo actual del sistema multideporte."
      />

      @if (loading()) {
        <app-loading-state />
      } @else {
        <div class="context-banner">
          <strong>Resumen transversal del frontend</strong>
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
      }
    </section>
  `,
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
        meta: 'Competencias registradas',
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
        meta: 'Equipos vinculados a torneos'
      },
      {
        label: 'Rosters activos',
        value: summary?.activeRosterCount ?? 0,
        meta: 'Jugadores habilitados hoy'
      },
      {
        label: 'Partidos',
        value: summary?.matchCount ?? 0,
        meta: 'Fixture cargado en el sistema'
      },
      {
        label: 'Standings',
        value: summary?.standingsCount ?? 0,
        meta: 'Registros de tabla generados'
      }
    ];
  });
  protected readonly healthMessage = computed(() => {
    const summary = this.summary();
    if (!summary) {
      return '';
    }

    if (summary.tournamentCount === 0) {
      return 'No hay torneos cargados. El siguiente paso operativo es crear una competencia para activar el flujo multideporte.';
    }

    if (summary.registrationCount === 0) {
      return 'Hay torneos pero aun no existen inscripciones. Conviene continuar por Inscripciones para poblar la operacion.';
    }

    if (summary.matchCount === 0) {
      return 'La base competitiva ya existe, pero falta programar partidos para comenzar a generar resultados y standings.';
    }

    return 'La base operativa ya permite seguir el flujo torneo -> inscripciones -> rosters -> partidos -> standings.';
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
}
