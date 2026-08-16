import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule } from '@angular/material/core';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import {
  dateRangeValidator,
  parseBackendDate,
  PICHANGA_DATE_PICKER_PROVIDERS,
  toBackendDate
} from '../../shared/date/date-only.utils';
import { Sport } from '../sports/sport.models';
import { SportsService } from '../sports/sports.service';
import { TournamentFormat, TournamentFormValue, TournamentStatus } from './tournament.models';
import { TournamentsService } from './tournaments.service';

@Component({
  selector: 'app-tournament-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  providers: PICHANGA_DATE_PICKER_PROVIDERS,
  template: `
    <section class="app-page">
      <app-page-header
        [title]="isEditMode() ? 'Editar campeonato' : 'Nuevo campeonato'"
        subtitle="Configura los datos principales del campeonato."
      />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <section class="form-section">
              <div class="form-section-heading">
                <h2>Datos basicos</h2>
                <p class="muted">Identifica el campeonato para organizadores, equipos y reportes.</p>
              </div>

              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Deporte</mat-label>
                  <mat-select formControlName="sportId">
                    @for (sport of sports(); track sport.id) {
                      <mat-option [value]="sport.id">{{ sport.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Nombre del campeonato</mat-label>
                  <input matInput formControlName="name">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Temporada</mat-label>
                  <input matInput formControlName="seasonName">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Descripcion</mat-label>
                  <textarea matInput rows="4" formControlName="description"></textarea>
                </mat-form-field>
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-heading">
                <h2>Formato y reglas</h2>
                <p class="muted">Define como se juega y como se calcula la tabla de posiciones.</p>
              </div>

              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Formato de competencia</mat-label>
                  <mat-select formControlName="format">
                    @for (format of formats; track format) {
                      <mat-option [value]="format">{{ formatLabel(format) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                @if (!isEditMode()) {
                  <mat-form-field appearance="outline">
                    <mat-label>Estado inicial</mat-label>
                    <mat-select formControlName="status">
                      @for (status of statuses; track status) {
                        <mat-option [value]="status">{{ statusLabel(status) }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                } @else {
                  <mat-form-field appearance="outline">
                    <mat-label>Estado actual</mat-label>
                    <input matInput [value]="statusLabel(currentStatus())" readonly>
                  </mat-form-field>
                }

                <mat-form-field appearance="outline">
                  <mat-label>Maximo de equipos</mat-label>
                  <input matInput type="number" formControlName="maxTeams">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Puntos por victoria</mat-label>
                  <input matInput type="number" formControlName="pointsWin">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Puntos por empate</mat-label>
                  <input matInput type="number" formControlName="pointsDraw">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Puntos por derrota</mat-label>
                  <input matInput type="number" formControlName="pointsLoss">
                </mat-form-field>
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-heading">
                <h2>Fechas</h2>
                <p class="muted">Ubica el campeonato en una ventana operativa clara.</p>
              </div>

              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Inicio</mat-label>
                  <input matInput [matDatepicker]="startPicker" formControlName="startDate" placeholder="dd/mm/aaaa">
                  <mat-datepicker-toggle matIconSuffix [for]="startPicker" />
                  <mat-datepicker #startPicker />
                  <mat-hint>dd/mm/aaaa</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fin</mat-label>
                  <input matInput [matDatepicker]="endPicker" formControlName="endDate" placeholder="dd/mm/aaaa">
                  <mat-datepicker-toggle matIconSuffix [for]="endPicker" />
                  <mat-datepicker #endPicker />
                  <mat-hint>dd/mm/aaaa</mat-hint>
                  @if (form.hasError('dateRange')) {
                    <mat-error>La fecha fin no puede ser menor que la fecha inicio.</mat-error>
                  }
                </mat-form-field>
              </div>
            </section>

            <div class="form-actions">
              <a mat-stroked-button routerLink="/tournaments">Cancelar</a>
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
      .form-section {
        display: grid;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .form-section-heading h2 {
        margin: 0;
        font-size: 1rem;
      }

      .form-section-heading p {
        margin: 0.3rem 0 0;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sportsService = inject(SportsService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly tournamentId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.tournamentId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly sports = signal<Sport[]>([]);
  protected readonly currentStatus = signal<TournamentStatus>('DRAFT');
  protected readonly formats: TournamentFormat[] = ['LEAGUE', 'GROUPS_THEN_KNOCKOUT', 'KNOCKOUT'];
  protected readonly statuses: TournamentStatus[] = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'];

  protected readonly form = this.fb.nonNullable.group({
    sportId: [0, Validators.required],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    seasonName: ['', [Validators.required, Validators.maxLength(50)]],
    format: ['LEAGUE' as TournamentFormat, Validators.required],
    status: ['DRAFT' as TournamentStatus, Validators.required],
    description: [''],
    startDate: [null as Date | null],
    endDate: [null as Date | null],
    maxTeams: [''],
    pointsWin: [3],
    pointsDraw: [1],
    pointsLoss: [0]
  }, { validators: dateRangeValidator() });

  constructor() {
    this.sportsService.list(false).subscribe({
      next: (sports) => {
        this.sports.set(sports);
        if (!this.isEditMode() && sports.length > 0) {
          this.form.patchValue({ sportId: sports[0].id });
        }
      }
    });

    if (!this.isEditMode()) {
      this.pageLoading.set(false);
      return;
    }

    this.tournamentsService
      .getById(this.tournamentId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (tournament) => {
          this.currentStatus.set(tournament.status);
          this.form.patchValue({
            sportId: tournament.sportId,
            name: tournament.name,
            seasonName: tournament.seasonName,
            format: tournament.format,
            status: tournament.status,
            description: tournament.description ?? '',
            startDate: parseBackendDate(tournament.startDate),
            endDate: parseBackendDate(tournament.endDate),
            maxTeams: tournament.maxTeams ? String(tournament.maxTeams) : '',
            pointsWin: tournament.pointsWin,
            pointsDraw: tournament.pointsDraw,
            pointsLoss: tournament.pointsLoss
          });
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: TournamentFormValue = {
      sportId: Number(value.sportId),
      name: value.name,
      seasonName: value.seasonName,
      format: value.format,
      status: this.isEditMode() ? this.currentStatus() : value.status,
      description: value.description || null,
      startDate: toBackendDate(value.startDate),
      endDate: toBackendDate(value.endDate),
      registrationOpenAt: null,
      registrationCloseAt: null,
      maxTeams: value.maxTeams ? Number(value.maxTeams) : null,
      pointsWin: Number(value.pointsWin),
      pointsDraw: Number(value.pointsDraw),
      pointsLoss: Number(value.pointsLoss)
    };

    this.saving.set(true);
    const request$ = this.isEditMode()
      ? this.tournamentsService.update(this.tournamentId, payload)
      : this.tournamentsService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Campeonato guardado correctamente');
        void this.router.navigateByUrl('/tournaments');
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }

  protected formatLabel(format: TournamentFormat): string {
    const labels: Record<TournamentFormat, string> = {
      LEAGUE: 'Liga',
      GROUPS_THEN_KNOCKOUT: 'Grupos + eliminatoria',
      KNOCKOUT: 'Eliminatoria'
    };

    return labels[format];
  }

  protected statusLabel(status: TournamentStatus): string {
    const labels: Record<TournamentStatus, string> = {
      DRAFT: 'Borrador',
      OPEN: 'Inscripciones abiertas',
      IN_PROGRESS: 'En curso',
      FINISHED: 'Finalizado',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }
}
