import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../core/auth/auth.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="login-shell">
      <mat-card class="login-card card">
        <h1>Ingreso al MVP</h1>
        <p class="muted">Usa las credenciales válidas del backend Spring Boot.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="app-page">
          <mat-form-field appearance="outline">
            <mat-label>Usuario</mat-label>
            <input matInput formControlName="username" autocomplete="username">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="current-password">
          </mat-form-field>

          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading()">
              {{ loading() ? 'Validando...' : 'Ingresar' }}
            </button>
          </div>
        </form>
      </mat-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

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
          this.notifications.success('Sesión iniciada correctamente');
          void this.router.navigateByUrl('/dashboard');
        },
        error: (error: unknown) => {
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }
}
