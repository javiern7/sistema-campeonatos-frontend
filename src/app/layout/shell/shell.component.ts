import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';

import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [MatButtonModule, MatSidenavModule, RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <mat-sidenav-container class="shell-container">
      <mat-sidenav
        class="shell-sidebar"
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="isMobile() ? mobileNavOpen() : true"
        [fixedInViewport]="isMobile()"
        (closedStart)="mobileNavOpen.set(false)"
      >
        <div class="sidebar-content" (click)="closeMobileNav()">
          <app-sidebar />
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <button
          mat-stroked-button
          class="mobile-nav-toggle"
          type="button"
          [attr.aria-expanded]="mobileNavOpen()"
          (click)="mobileNavOpen.set(true)"
        >
          Navegacion
        </button>
        <app-topbar />

        <main class="shell-content">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell-container {
        min-height: 100vh;
        background:
          linear-gradient(135deg, rgba(10, 110, 90, 0.07), rgba(14, 116, 144, 0.05) 42%, rgba(124, 58, 237, 0.04)),
          var(--app-bg);
      }

      .shell-sidebar {
        width: 280px;
        border-right: 1px solid rgba(255, 255, 255, 0.12);
      }

      .sidebar-content {
        height: 100%;
      }

      .mobile-nav-toggle {
        display: none;
        margin: 0.75rem 1rem 0;
      }

      .shell-content {
        padding: 1.25rem;
        max-width: 1600px;
      }

      @media (max-width: 900px) {
        .shell-sidebar {
          width: min(82vw, 300px);
        }

        .mobile-nav-toggle {
          display: inline-flex;
        }

        .shell-content {
          padding: 1rem;
        }
      }

      @media (max-width: 520px) {
        .shell-content {
          padding: 0.85rem;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly mobileNavOpen = signal(false);
  protected readonly isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 900px)').pipe(map((state) => state.matches)),
    { initialValue: false }
  );

  protected closeMobileNav(): void {
    if (this.isMobile()) {
      this.mobileNavOpen.set(false);
    }
  }
}
