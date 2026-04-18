import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="login-shell">
      <section class="login-stage">
        <div class="login-visual" aria-hidden="true">
          <div class="visual-copy">
            <span class="login-kicker">Sistema multideporte</span>
            <strong>Operacion lista para demo</strong>
            <p>Gestiona torneos, partidos, standings y reportes desde una vista clara y segura.</p>
          </div>
        </div>

        <mat-card class="login-card card">
          <span class="login-kicker">Acceso privado</span>
          <h1>Ingreso operativo</h1>
          <p class="muted">
            Usa tus credenciales reales. La identidad, roles y permisos se cargan desde el backend.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
            <mat-form-field appearance="outline">
              <mat-label>Usuario</mat-label>
              <input matInput formControlName="username" autocomplete="username">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Contrasena</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password">
            </mat-form-field>

            <div class="login-support">
              <span>Token Bearer y permisos efectivos</span>
              <span>Sesion auditada</span>
            </div>

            <div class="form-actions">
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading()">
                {{ loading() ? 'Iniciando sesion...' : 'Ingresar' }}
              </button>
            </div>
          </form>
        </mat-card>
      </section>
    </div>
  `,
  styles: [
    `
      .login-stage {
        width: min(1040px, 100%);
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
        min-height: 620px;
        overflow: hidden;
        border-radius: 8px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: var(--surface);
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
      }

      .login-visual {
        min-height: 100%;
        display: flex;
        align-items: flex-end;
        padding: 2rem;
        background:
          linear-gradient(180deg, rgba(7, 89, 73, 0.16), rgba(7, 89, 73, 0.88)),
          linear-gradient(120deg, rgba(14, 116, 144, 0.25), rgba(109, 91, 208, 0.2)),
          url('/assets/login-demo-sports.svg') center / cover;
        color: #ffffff;
      }

      .visual-copy {
        width: min(520px, 100%);
        display: grid;
        gap: 0.75rem;
      }

      .visual-copy strong {
        font-size: 2.4rem;
        line-height: 1.05;
      }

      .visual-copy p {
        margin: 0;
        color: rgba(255, 255, 255, 0.88);
        font-size: 1rem;
        line-height: 1.5;
      }

      .login-card {
        width: 100%;
        display: grid;
        align-content: center;
        gap: 1rem;
        padding: 2rem;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .login-kicker {
        width: fit-content;
        padding: 0.32rem 0.7rem;
        border-radius: 999px;
        background: rgba(10, 110, 90, 0.1);
        color: var(--primary-strong);
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .login-visual .login-kicker {
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
      }

      h1 {
        margin: 0;
        font-size: 2rem;
        line-height: 1.1;
      }

      .login-card p {
        margin: 0;
        line-height: 1.5;
      }

      .login-form {
        display: grid;
        gap: 0.95rem;
      }

      .login-support {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .login-support span {
        padding: 0.38rem 0.62rem;
        border-radius: 999px;
        background: rgba(14, 116, 144, 0.1);
        color: #075985;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .form-actions button {
        min-height: 44px;
        padding-inline: 1.4rem;
      }

      @media (max-width: 840px) {
        .login-stage {
          grid-template-columns: 1fr;
          min-height: auto;
        }

        .login-visual {
          min-height: 240px;
          align-items: flex-end;
        }

        .visual-copy strong {
          font-size: 1.8rem;
        }

        .login-card {
          padding: 1.5rem;
        }
      }

      @media (max-width: 520px) {
        .login-visual {
          min-height: 210px;
          padding: 1.25rem;
        }

        .login-card {
          padding: 1.25rem;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  constructor() {
    if (this.authStore.isAuthenticated()) {
      void this.router.navigateByUrl('/dashboard');
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    const { username, password } = this.form.getRawValue();
    this.loading.set(true);

    this.authService
      .login(username, password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Sesion iniciada correctamente');
          void this.router.navigateByUrl('/dashboard');
        },
        error: (error: unknown) => {
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }
}
