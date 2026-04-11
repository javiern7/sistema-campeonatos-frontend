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
    PageHeaderComponent,
    VisualIdentityComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header
        [title]="isEditMode() ? 'Editar equipo' : 'Nuevo equipo'"
        subtitle="Datos visibles del equipo sin abrir logos, imagenes ni CMS."
      />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <div class="form-preview">
              <app-visual-identity
                [label]="form.controls.name.value"
                [shortLabel]="form.controls.shortName.value"
                [code]="form.controls.code.value"
                [primary]="form.controls.primaryColor.value"
                [secondary]="form.controls.secondaryColor.value"
                meta="Vista previa operativa"
              />
              <p class="muted">La identidad usa abreviatura, codigo o iniciales. No requiere assets externos.</p>
            </div>

            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput formControlName="name">
                @if (form.controls.name.hasError('required')) {
                  <mat-error>El nombre del equipo es obligatorio.</mat-error>
                }
                @if (form.controls.name.hasError('maxlength')) {
                  <mat-error>Usa 150 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nombre corto</mat-label>
                <input matInput formControlName="shortName">
                <mat-hint>Se usa como abreviatura visual cuando exista.</mat-hint>
                @if (form.controls.shortName.hasError('maxlength')) {
                  <mat-error>Usa 50 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Codigo</mat-label>
                <input matInput formControlName="code">
                <mat-hint>Codigo corto para tablas y resultados.</mat-hint>
                @if (form.controls.code.hasError('maxlength')) {
                  <mat-error>Usa 30 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Color primario</mat-label>
                <input matInput formControlName="primaryColor">
                <mat-hint>Opcional. Ejemplo: #0a6e5a.</mat-hint>
                @if (form.controls.primaryColor.hasError('maxlength')) {
                  <mat-error>Usa 20 caracteres como maximo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Color secundario</mat-label>
                <input matInput formControlName="secondaryColor">
                <mat-hint>Opcional para acento visual.</mat-hint>
                @if (form.controls.secondaryColor.hasError('maxlength')) {
                  <mat-error>Usa 20 caracteres como maximo.</mat-error>
                }
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
