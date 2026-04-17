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
        min-width: 0;
      }

      .page-header > div {
        min-width: 0;
      }

      h1 {
        margin: 0;
        font-size: 1.75rem;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }

      p {
        margin: 0.35rem 0 0;
        color: var(--text-soft);
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      @media (max-width: 720px) {
        .page-header {
          align-items: stretch;
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
