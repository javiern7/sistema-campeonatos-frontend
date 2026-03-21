import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';

import { APP_NAV_ITEMS } from '../app-nav';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatListModule],
  template: `
    <div class="sidebar-brand">
      <span class="sidebar-kicker">MVP Interno</span>
      <strong>Championships</strong>
    </div>

    <mat-nav-list>
      @for (item of navItems; track item.path) {
        <a
          mat-list-item
          [routerLink]="item.path"
          routerLinkActive="active-link"
          [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
        >
          {{ item.label }}
        </a>
      }
    </mat-nav-list>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        padding: 1rem 0.75rem;
        background: linear-gradient(180deg, #10232b 0%, #163847 100%);
        color: #f8fafc;
      }

      .sidebar-brand {
        padding: 0.75rem 1rem 1.25rem;
      }

      .sidebar-kicker {
        display: block;
        color: #9ac6bb;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      strong {
        display: block;
        margin-top: 0.2rem;
        font-size: 1.2rem;
      }

      a {
        color: #e2e8f0;
        border-radius: 12px;
        margin-bottom: 0.15rem;
      }

      .active-link {
        background: rgba(255, 255, 255, 0.12);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  protected readonly navItems = APP_NAV_ITEMS;
}
