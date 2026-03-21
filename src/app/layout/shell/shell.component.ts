import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';

import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [MatSidenavModule, RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <mat-sidenav-container class="shell-container">
      <mat-sidenav class="shell-sidebar" mode="side" [opened]="true">
        <app-sidebar />
      </mat-sidenav>

      <mat-sidenav-content>
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
      }

      .shell-sidebar {
        width: 280px;
        border-right: 1px solid rgba(255, 255, 255, 0.06);
      }

      .shell-content {
        padding: 1.25rem;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent {}
