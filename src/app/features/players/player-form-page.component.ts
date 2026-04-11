import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { VisualIdentityComponent } from '../../shared/visual-identity/visual-identity.component';
import { PlayerFormValue } from './player.models';
import { PlayersService } from './players.service';

@Component({
  selector: 'app-player-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    LoadingStateComponent,
    PageHeaderComponent,
    VisualIdentityComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header
        [title]="isEditMode() ? 'Editar jugador' : 'Nuevo jugador'"
        subtitle="Datos personales visibles con avatar generado por iniciales."
      />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <div class="form-preview">
              <app-visual-identity
                kind="player"
                [label]="form.controls.firstName.value + ' ' + form.controls.lastName.value"
                [shortLabel]="playerInitialSource()"
                meta="Vista previa operativa"
              />
              <p class="muted">El avatar usa iniciales; no requiere foto ni campo adicional en backend.</p>
            </div>

            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Nombres</mat-label>
                <input matInput formControlName="firstName">
                @if (form.controls.firstName.hasError('required')) {
                  <mat-error>Los nombres son obligatorios.</mat-error>
                }
                @if (form.controls.firstName.hasError('maxlength')) {
                  <mat-error>Usa 100 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Apellidos</mat-label>
                <input matInput formControlName="lastName">
                @if (form.controls.lastName.hasError('required')) {
                  <mat-error>Los apellidos son obligatorios.</mat-error>
                }
                @if (form.controls.lastName.hasError('maxlength')) {
                  <mat-error>Usa 100 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Tipo documento</mat-label>
                <input matInput formControlName="documentType">
                @if (form.controls.documentType.hasError('maxlength')) {
                  <mat-error>Usa 20 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Numero documento</mat-label>
                <input matInput formControlName="documentNumber">
                @if (form.controls.documentNumber.hasError('maxlength')) {
                  <mat-error>Usa 30 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha de nacimiento</mat-label>
                <input matInput type="date" formControlName="birthDate">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email">
                @if (form.controls.email.hasError('email')) {
                  <mat-error>Ingresa un email valido.</mat-error>
                }
                @if (form.controls.email.hasError('maxlength')) {
                  <mat-error>Usa 150 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Telefono</mat-label>
                <input matInput formControlName="phone">
                @if (form.controls.phone.hasError('maxlength')) {
                  <mat-error>Usa 30 caracteres como maximo.</mat-error>
                }
              </mat-form-field>
            </div>

            <mat-checkbox formControlName="active">Activo</mat-checkbox>

            <div class="form-actions">
              <a mat-stroked-button routerLink="/players">Cancelar</a>
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        }
      </section>
    </section>
  `,
  styles: [
    `
      .form-preview {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border: 1px solid rgba(10, 110, 90, 0.16);
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(10, 110, 90, 0.08), rgba(14, 116, 144, 0.04));
      }

      .form-preview p {
        margin: 0;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly playersService = inject(PlayersService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly playerId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.playerId > 0);
  protected readonly pageLoading = signal(this.isEditMode());
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    documentType: ['', Validators.maxLength(20)],
    documentNumber: ['', Validators.maxLength(30)],
    birthDate: [''],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    phone: ['', Validators.maxLength(30)],
    active: [true]
  });

  constructor() {
    if (!this.isEditMode()) {
      return;
    }

    this.playersService
      .getById(this.playerId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (player) =>
          this.form.patchValue({
            firstName: player.firstName,
            lastName: player.lastName,
            documentType: player.documentType ?? '',
            documentNumber: player.documentNumber ?? '',
            birthDate: player.birthDate ?? '',
            email: player.email ?? '',
            phone: player.phone ?? '',
            active: player.active
          }),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const payload = this.form.getRawValue() as PlayerFormValue;
    this.saving.set(true);

    const request$ = this.isEditMode()
      ? this.playersService.update(this.playerId, payload)
      : this.playersService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Jugador guardado correctamente');
        void this.router.navigateByUrl('/players');
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }

  protected playerInitialSource(): string {
    return `${this.form.controls.firstName.value[0] ?? ''}${this.form.controls.lastName.value[0] ?? ''}`;
  }
}
