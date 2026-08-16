import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { NotificationService } from '../../core/error/notification.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, RouterLink],
  template: `
    <mat-toolbar class="topbar">
      <div>
        <div class="topbar-title">Sistema Multideporte</div>
        <div class="topbar-subtitle">{{ sessionSummary() }}</div>
      </div>

      <span class="topbar-spacer"></span>

      <div class="topbar-user">
        <div>{{ fullName() }}</div>
        <div class="topbar-roles">{{ roles().join(' | ') || 'Usuario autenticado' }}</div>
        <div class="topbar-expiry">{{ accessExpiryLabel() }}</div>
      </div>
      <a mat-stroked-button routerLink="/portal">Portal publico</a>
      <button mat-stroked-button type="button" (click)="logout()" [disabled]="loggingOut()">
        {{ loggingOut() ? 'Cerrando...' : 'Salir' }}
      </button>
    </mat-toolbar>
  `,
  styles: [
    `
      .topbar {
        background: rgba(255, 255, 255, 0.9);
        border-bottom: 1px solid var(--border);
        backdrop-filter: blur(14px);
        gap: 0.75rem;
        min-height: 70px;
        padding-inline: 1.25rem;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.86);
      }

      .topbar-title {
        color: var(--text);
        font-weight: 800;
        line-height: 1.2;
      }

      .topbar-subtitle,
      .topbar-expiry {
        color: var(--text-soft);
        font-size: 0.85rem;
        line-height: 1.35;
      }

      .topbar-spacer {
        flex: 1;
      }

      .topbar-user {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin-right: 0.65rem;
        color: var(--text-soft);
        max-width: 36rem;
        min-width: 0;
        text-align: right;
        word-break: break-word;
      }

      a[mat-stroked-button] {
        margin-right: 0.5rem;
      }

      .topbar-roles {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--primary-strong);
        font-weight: 800;
      }

      @media (max-width: 900px) {
        .topbar {
          align-items: flex-start;
          flex-wrap: wrap;
          height: auto;
          padding-block: 0.75rem;
        }

        .topbar-spacer {
          display: none;
        }

        .topbar-user {
          order: 3;
          width: 100%;
          align-items: flex-start;
          margin-right: 0;
          text-align: left;
        }

        a[mat-stroked-button] {
          margin-right: 0;
        }
      }

      @media (max-width: 520px) {
        a[mat-stroked-button],
        button[mat-stroked-button] {
          flex: 1 1 100%;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly authorization = inject(AuthorizationService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly loggingOut = signal(false);
  protected readonly fullName = computed(() => this.authStore.fullName());
  protected readonly roles = computed(() => this.authorization.roleLabels());
  protected readonly sessionSummary = computed(() => {
    return 'Gestion centralizada de campeonatos y participantes';
  });
  protected readonly accessExpiryLabel = computed(() => {
    const value = this.authStore.accessTokenExpiresAt();
    if (!value) {
      return 'Sesion activa';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Sesion activa';
    }

    return `Sesion activa hasta ${new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(parsed)}`;
  });

  protected logout(): void {
    if (this.loggingOut()) {
      return;
    }

    this.loggingOut.set(true);
    this.authService
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Sesion cerrada correctamente');
          void this.router.navigateByUrl('/login');
        }
      });
  }
}
