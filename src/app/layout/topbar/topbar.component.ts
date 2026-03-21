import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar class="topbar">
      <div>
        <div class="topbar-title">Sistema Multideporte</div>
        <div class="topbar-subtitle">Operación del MVP interno</div>
      </div>

      <span class="topbar-spacer"></span>

      <div class="topbar-user">{{ username() }}</div>
      <button mat-stroked-button type="button" (click)="logout()">Salir</button>
    </mat-toolbar>
  `,
  styles: [
    `
      .topbar {
        background: rgba(255, 255, 255, 0.88);
        border-bottom: 1px solid var(--border);
        backdrop-filter: blur(14px);
      }

      .topbar-title {
        font-weight: 700;
      }

      .topbar-subtitle {
        color: var(--text-soft);
        font-size: 0.85rem;
      }

      .topbar-spacer {
        flex: 1;
      }

      .topbar-user {
        margin-right: 0.75rem;
        color: var(--text-soft);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly username = computed(() => this.authStore.username());

  protected logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
