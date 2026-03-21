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
import { TeamFormValue } from './team.models';
import { TeamsService } from './teams.service';

@Component({
  selector: 'app-team-form-page',
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
        [title]="isEditMode() ? 'Editar Team' : 'Nuevo Team'"
        subtitle="Formulario alineado con TeamCreateRequest y TeamUpdateRequest."
      />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput formControlName="name">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Short name</mat-label>
                <input matInput formControlName="shortName">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Código</mat-label>
                <input matInput formControlName="code">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Color primario</mat-label>
                <input matInput formControlName="primaryColor">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Color secundario</mat-label>
                <input matInput formControlName="secondaryColor">
              </mat-form-field>
            </div>

            <mat-checkbox formControlName="active">Activo</mat-checkbox>

            <div class="form-actions">
              <a mat-stroked-button routerLink="/teams">Cancelar</a>
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
export class TeamFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly teamsService = inject(TeamsService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly teamId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.teamId > 0);
  protected readonly pageLoading = signal(this.isEditMode());
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    shortName: ['', Validators.maxLength(50)],
    code: ['', Validators.maxLength(30)],
    primaryColor: ['', Validators.maxLength(20)],
    secondaryColor: ['', Validators.maxLength(20)],
    active: [true]
  });

  constructor() {
    if (!this.isEditMode()) {
      return;
    }

    this.teamsService
      .getById(this.teamId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (team) =>
          this.form.patchValue({
            name: team.name,
            shortName: team.shortName ?? '',
            code: team.code ?? '',
            primaryColor: team.primaryColor ?? '',
            secondaryColor: team.secondaryColor ?? '',
            active: team.active
          }),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const payload = this.form.getRawValue() as TeamFormValue;
    this.saving.set(true);

    const request$ = this.isEditMode()
      ? this.teamsService.update(this.teamId, payload)
      : this.teamsService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Equipo guardado correctamente');
        void this.router.navigateByUrl('/teams');
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }
}
