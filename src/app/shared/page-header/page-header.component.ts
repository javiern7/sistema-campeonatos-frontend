import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-header">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>

      <ng-content />
    </header>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        gap: 1rem;
        align-items: start;
        justify-content: space-between;
      }

      h1 {
        margin: 0;
        font-size: 1.75rem;
      }

      p {
        margin: 0.35rem 0 0;
        color: var(--text-soft);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
