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
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header
        [title]="isEditMode() ? 'Editar Player' : 'Nuevo Player'"
        subtitle="Formulario alineado con PlayerCreateRequest y PlayerUpdateRequest."
      />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Nombres</mat-label>
                <input matInput formControlName="firstName">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Apellidos</mat-label>
                <input matInput formControlName="lastName">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Tipo documento</mat-label>
                <input matInput formControlName="documentType">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Número documento</mat-label>
                <input matInput formControlName="documentNumber">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha de nacimiento</mat-label>
                <input matInput type="date" formControlName="birthDate">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Teléfono</mat-label>
                <input matInput formControlName="phone">
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
}
