import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthorizationService } from '../../core/auth/authorization.service';
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
        <div class="topbar-subtitle">{{ authorizationSubtitle() }}</div>
      </div>

      <span class="topbar-spacer"></span>

      <div class="topbar-user">
        <div>{{ fullName() }}</div>
        <div class="topbar-roles">{{ roles().join(' | ') || 'AUTHENTICATED' }}</div>
      </div>
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
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin-right: 0.75rem;
        color: var(--text-soft);
      }

      .topbar-roles {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly authorization = inject(AuthorizationService);
  private readonly router = inject(Router);

  protected readonly fullName = computed(() => this.authStore.fullName());
  protected readonly roles = computed(() => this.authorization.roleLabels());
  protected readonly authorizationSubtitle = computed(() =>
    this.authStore.authorizationSource() === 'backend-session'
      ? 'Autorizacion derivada del backend'
      : 'Autorizacion temporal de transicion'
  );

  protected logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
