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
        padding: 1.5rem;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.46);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingStateComponent {
  readonly label = input('Cargando...');
}
