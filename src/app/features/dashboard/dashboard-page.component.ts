import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { MatCardModule } from '@angular/material/card';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { DashboardSummary } from './dashboard.models';
import { DashboardService } from './dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [MatCardModule, PageHeaderComponent, LoadingStateComponent],
  template: `
    <section class="app-page">
      <app-page-header
        title="Dashboard"
        subtitle="Vista rápida del estado inicial del MVP conectado al backend real."
      />

      @if (loading()) {
        <app-loading-state />
      } @else {
        <div class="summary-grid">
          <mat-card class="summary-card card">
            <span class="summary-label">Sports</span>
            <span class="summary-value">{{ summary()?.sportCount ?? 0 }}</span>
          </mat-card>

          <mat-card class="summary-card card">
            <span class="summary-label">Teams</span>
            <span class="summary-value">{{ summary()?.teamCount ?? 0 }}</span>
          </mat-card>

          <mat-card class="summary-card card">
            <span class="summary-label">Players</span>
            <span class="summary-value">{{ summary()?.playerCount ?? 0 }}</span>
          </mat-card>
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
