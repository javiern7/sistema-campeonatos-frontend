import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="loading-state">
      <mat-spinner diameter="36"></mat-spinner>
      <span>{{ label() }}</span>
    </div>
  `,
  styles: [
    `
      .loading-state {
        min-height: 180px;
        display: grid;
        place-content: center;
        gap: 0.75rem;
        justify-items: center;
        color: var(--text-soft);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingStateComponent {
  readonly label = input('Cargando...');
}
