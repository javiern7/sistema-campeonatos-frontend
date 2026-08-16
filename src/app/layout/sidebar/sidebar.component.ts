import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { APP_NAV_GROUPS, type AppNavGroup } from '../app-nav';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatListModule],
  template: `
    <div class="sidebar-brand">
      <span class="sidebar-kicker">Plataforma deportiva</span>
      <strong>Sistema Campeonatos</strong>
    </div>

    <mat-nav-list class="nav-list">
      @for (group of navGroups(); track group.label) {
        <div class="nav-group">
          <span class="nav-group-label">{{ group.label }}</span>
          @for (item of group.items; track item.path) {
            <a
              mat-list-item
              [routerLink]="item.path"
              routerLinkActive="active-link"
              [routerLinkActiveOptions]="{ exact: exactActive(item.path) }"
            >
              {{ item.label }}
            </a>
          }
        </div>
      }
    </mat-nav-list>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        padding: 1rem 0.75rem;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0)),
          linear-gradient(155deg, #123c34 0%, #0f5f5b 52%, #38477a 100%);
        color: #f8fafc;
      }

      .sidebar-brand {
        padding: 0.75rem 1rem 1.25rem;
      }

      .sidebar-kicker {
        display: block;
        color: #b9eadf;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      strong {
        display: block;
        margin-top: 0.2rem;
        font-size: 1.2rem;
      }

      .nav-list {
        padding-top: 0.1rem;
      }

      .nav-group {
        display: grid;
        gap: 0.12rem;
        margin: 0 0 0.65rem;
      }

      .nav-group-label {
        padding: 0.45rem 1rem 0.25rem;
        color: #b9eadf;
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      a {
        color: #e2e8f0;
        border-radius: 8px;
        margin-bottom: 0.15rem;
      }

      .active-link {
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
      }

      @media (max-width: 900px) {
        :host {
          overflow-y: auto;
        }

        .nav-group {
          margin-bottom: 0.5rem;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  private readonly authorization = inject(AuthorizationService);

  protected readonly navGroups = computed<AppNavGroup[]>(() =>
    APP_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.resource || this.authorization.canAccess(item.resource, item.action ?? 'read'))
    })).filter((group) => group.items.length > 0)
  );

  protected exactActive(path: string): boolean {
    return path === '/dashboard' || path === '/portal';
  }
}
