import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="public-shell">
      <header class="public-topbar">
        <a class="brand" routerLink="/portal">
          <span class="brand-kicker">Portal publico</span>
          <strong>Sistema Campeonatos</strong>
        </a>

        <nav class="public-nav" aria-label="Navegacion publica">
          <a routerLink="/portal" [routerLinkActive]="'active'" [routerLinkActiveOptions]="{ exact: true }">Inicio</a>
          <a routerLink="/portal/tournaments" routerLinkActive="active">Torneos</a>
          <a routerLink="/login">Ingresar</a>
        </nav>
      </header>

      <main class="public-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .public-shell {
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(10, 110, 90, 0.12), transparent 28%),
          linear-gradient(180deg, #f8fbfc 0%, #eef4f6 100%);
      }

      .public-topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.5rem;
        backdrop-filter: blur(14px);
        background: rgba(248, 251, 252, 0.9);
        border-bottom: 1px solid rgba(23, 33, 43, 0.08);
      }

      .brand {
        display: grid;
        gap: 0.1rem;
        color: inherit;
        text-decoration: none;
      }

      .brand-kicker {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--primary);
      }

      .public-nav {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
        justify-content: end;
      }

      .public-nav a {
        padding: 0.55rem 0.9rem;
        border-radius: 999px;
        color: var(--text);
        text-decoration: none;
        font-weight: 600;
      }

      .public-nav a.active,
      .public-nav a:hover {
        background: rgba(10, 110, 90, 0.1);
        color: var(--primary);
      }

      .public-content {
        width: min(1180px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 1.5rem 0 2.5rem;
      }

      @media (max-width: 720px) {
        .public-topbar {
          align-items: start;
          flex-direction: column;
        }

        .public-content {
          width: min(100%, calc(100% - 1rem));
          padding-top: 1rem;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicShellComponent {}
