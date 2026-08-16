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
        padding: 1rem 0.8rem;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 34%),
          linear-gradient(160deg, #0b302d 0%, #0d4f48 56%, #233b63 100%);
        color: #f8fafc;
      }

      .sidebar-brand {
        padding: 0.8rem 0.95rem 1.15rem;
        margin-bottom: 0.15rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
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
        font-size: 1.16rem;
        line-height: 1.18;
      }

      .nav-list {
        padding-top: 0.1rem;
      }

      .nav-group {
        display: grid;
        gap: 0.08rem;
        margin: 0 0 0.7rem;
      }

      .nav-group-label {
        padding: 0.5rem 0.95rem 0.28rem;
        color: rgba(210, 246, 238, 0.86);
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      a {
        min-height: 38px;
        color: rgba(241, 245, 249, 0.9);
        border-radius: 8px;
        margin-bottom: 0.08rem;
        transition:
          background 140ms ease,
          color 140ms ease,
          transform 140ms ease;
      }

      a:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      .active-link {
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
        box-shadow: inset 3px 0 0 #7dd3c7;
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
