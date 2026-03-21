import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Tournament, TournamentPage } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { TournamentStageFormValue, TournamentStageType } from './tournament-stage.models';
import { TournamentStagesService } from './tournament-stages.service';

@Component({
  selector: 'app-tournament-stage-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header [title]="isEditMode() ? 'Editar etapa' : 'Nueva etapa'" subtitle="Configuración de etapas por torneo." />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <div class="form-grid">
              @if (!isEditMode()) {
                <mat-form-field appearance="outline">
                  <mat-label>Torneo</mat-label>
                  <mat-select formControlName="tournamentId">
                    @for (item of tournaments(); track item.id) {
                      <mat-option [value]="item.id">{{ item.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }

              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput formControlName="name">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="stageType">
                  @for (type of types; track type) {
                    <mat-option [value]="type">{{ type }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Orden</mat-label>
                <input matInput type="number" formControlName="sequenceOrder">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Legs</mat-label>
                <input matInput type="number" formControlName="legs">
              </mat-form-field>
            </div>

            <mat-checkbox formControlName="roundTrip">Ida y vuelta</mat-checkbox>
            <mat-checkbox formControlName="active">Activa</mat-checkbox>

            <div class="form-actions">
              <a mat-stroked-button routerLink="/tournament-stages">Cancelar</a>
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
export class TournamentStageFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly stageId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.stageId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly types: TournamentStageType[] = ['LEAGUE', 'GROUP_STAGE', 'KNOCKOUT'];

  protected readonly form = this.fb.nonNullable.group({
    tournamentId: [0],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    stageType: ['LEAGUE' as TournamentStageType, Validators.required],
    sequenceOrder: [1, Validators.required],
    legs: [1, Validators.required],
    roundTrip: [false],
    active: [true]
  });

  constructor() {
    this.tournamentsService.list({ page: 0, size: 100 }).subscribe({
      next: (page: TournamentPage) => {
        this.tournaments.set(page.content);
        if (!this.isEditMode() && page.content.length > 0) {
          this.form.patchValue({ tournamentId: page.content[0].id });
        }
      }
    });

    if (!this.isEditMode()) {
      this.pageLoading.set(false);
      return;
    }

    this.stagesService
      .getById(this.stageId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (stage) =>
          this.form.patchValue({
            tournamentId: stage.tournamentId,
            name: stage.name,
            stageType: stage.stageType,
            sequenceOrder: stage.sequenceOrder,
            legs: stage.legs,
            roundTrip: stage.roundTrip,
            active: stage.active
          }),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: TournamentStageFormValue = {
      tournamentId: Number(value.tournamentId),
      name: value.name,
      stageType: value.stageType,
      sequenceOrder: Number(value.sequenceOrder),
      legs: Number(value.legs),
      roundTrip: value.roundTrip,
      active: value.active
    };

    this.saving.set(true);
    const request$ = this.isEditMode()
      ? this.stagesService.update(this.stageId, {
          name: payload.name,
          stageType: payload.stageType,
          sequenceOrder: payload.sequenceOrder,
          legs: payload.legs,
          roundTrip: payload.roundTrip,
          active: payload.active
        })
      : this.stagesService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Etapa guardada correctamente');
        void this.router.navigateByUrl('/tournament-stages');
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }
}
