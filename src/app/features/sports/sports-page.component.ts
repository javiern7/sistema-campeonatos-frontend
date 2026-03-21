import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { MatTableModule } from '@angular/material/table';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Sport } from './sport.models';
import { SportsService } from './sports.service';

@Component({
  selector: 'app-sports-page',
  standalone: true,
  imports: [MatTableModule, LoadingStateComponent, PageHeaderComponent],
  template: `
    <section class="app-page">
      <app-page-header
        title="Sports"
        subtitle="Catálogo maestro leído desde /sports del backend."
      />

      <section class="card page-card">
        @if (loading()) {
          <app-loading-state />
        } @else {
          <div class="table-wrapper">
            <table mat-table [dataSource]="sports()" class="w-100">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let sport">{{ sport.id }}</td>
              </ng-container>

              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef>Code</th>
                <td mat-cell *matCellDef="let sport">{{ sport.code }}</td>
              </ng-container>

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let sport">{{ sport.name }}</td>
              </ng-container>

              <ng-container matColumnDef="active">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let sport">
                  <span class="chip-status" [class.active]="sport.active" [class.inactive]="!sport.active">
                    {{ sport.active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        }
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SportsPageComponent {
  private readonly sportsService = inject(SportsService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly sports = signal<Sport[]>([]);
  protected readonly displayedColumns = ['id', 'code', 'name', 'active'];

  constructor() {
    this.sportsService
      .list(true)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (sports) => this.sports.set(sports),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }
}
