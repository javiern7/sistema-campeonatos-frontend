import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { BasicConfiguration } from './users-basic.models';
import { UsersBasicService } from './users-basic.service';

@Component({
  selector: 'app-basic-configuration-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header
        title="Configuracion basica"
        subtitle="Lectura y actualizacion acotada de nombre operativo, correo de soporte y zona horaria por defecto."
      />

      <section class="card page-card app-page">
        <div class="context-banner">
          <strong>Alcance del bloque</strong>
          <span class="muted">No es un motor general de settings: solo expone la configuracion operativa minima declarada por backend.</span>
        </div>

        @if (loading()) {
          <app-loading-state label="Cargando configuracion basica..." />
        } @else {
          <form [formGroup]="form" class="settings-form">
            <mat-form-field appearance="outline">
              <mat-label>Nombre operativo</mat-label>
              <input matInput formControlName="organizationName">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email de soporte</mat-label>
              <input matInput type="email" formControlName="supportEmail">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Zona horaria por defecto</mat-label>
              <input matInput formControlName="defaultTimezone" placeholder="America/Lima">
            </mat-form-field>
          </form>

          <div class="context-banner neutral-banner">
            <strong>Ultima actualizacion</strong>
            <span class="muted">{{ updatedAtLabel() }}</span>
          </div>

          <div class="actions-row">
            <button mat-stroked-button type="button" (click)="reload()">Recargar</button>
            @if (canManage()) {
              <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()">
                {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
              </button>
            } @else {
              <span class="muted">Tu sesion tiene solo lectura para este bloque.</span>
            }
          </div>
        }
      </section>
    </section>
  `,
  styles: [
    `
      .settings-form {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .neutral-banner {
        background: linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(14, 116, 144, 0.02));
        border-color: rgba(14, 116, 144, 0.16);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BasicConfigurationPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly usersBasicService = inject(UsersBasicService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly configuration = signal<BasicConfiguration | null>(null);
  protected readonly canManage = computed(() => this.authorization.canManage('configuration:basic'));
  protected readonly updatedAtLabel = computed(() => {
    const updatedAt = this.configuration()?.updatedAt;
    if (!updatedAt) {
      return 'Sin marca temporal disponible';
    }

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(updatedAt));
  });

  protected readonly form = this.fb.nonNullable.group({
    organizationName: ['', [Validators.required, Validators.maxLength(120)]],
    supportEmail: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    defaultTimezone: ['', [Validators.required, Validators.maxLength(80)]]
  });

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.usersBasicService
      .getBasicConfiguration()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (configuration) => {
          this.configuration.set(configuration);
          this.form.setValue({
            organizationName: configuration.organizationName,
            supportEmail: configuration.supportEmail,
            defaultTimezone: configuration.defaultTimezone
          });
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.usersBasicService
      .updateBasicConfiguration({
        organizationName: value.organizationName.trim(),
        supportEmail: value.supportEmail.trim(),
        defaultTimezone: value.defaultTimezone.trim()
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (configuration) => {
          this.configuration.set(configuration);
          this.form.setValue({
            organizationName: configuration.organizationName,
            supportEmail: configuration.supportEmail,
            defaultTimezone: configuration.defaultTimezone
          });
          this.notifications.success('Configuracion basica actualizada correctamente.');
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }
}
