import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Player } from '../players/player.models';
import { PlayersService } from '../players/players.service';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { RosterFormValue, RosterStatus } from './roster.models';
import { RostersService } from './rosters.service';

const positiveSelectionValidator = (fieldName: string): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    return Number(control.value) > 0 ? null : { [fieldName]: true };
  };
};

const parseOptionalNumber = (value: string | number | null | undefined): number | null => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const dateRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const startDate = control.get('startDate')?.value;
  const endDate = control.get('endDate')?.value;

  if (!startDate || !endDate) {
    return null;
  }

  return endDate >= startDate ? null : { invalidDateRange: true };
};

const rosterOperationalValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const tournamentTeamId = Number(control.get('tournamentTeamId')?.value);
  const registrationStatus = control.get('registrationStatus')?.value;
  const rosterStatus = control.get('rosterStatus')?.value as RosterStatus;

  if (tournamentTeamId > 0 && rosterStatus === 'ACTIVE' && registrationStatus && registrationStatus !== 'APPROVED') {
    return { activeRosterWithoutApprovedRegistration: true };
  }

  return null;
};

@Component({
  selector: 'app-roster-form-page',
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
      <app-page-header [title]="isEditMode() ? 'Editar roster' : 'Nuevo roster'" subtitle="Registro de jugador en roster." />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            @if (operationalWarning()) {
              <div class="context-banner">
                <strong>Auditoria Sprint 7</strong>
                <span class="muted">{{ operationalWarning() }}</span>
              </div>
            }

            <div class="form-grid">
              @if (!isEditMode()) {
                <mat-form-field appearance="outline">
                  <mat-label>Inscripcion</mat-label>
                  <mat-select formControlName="tournamentTeamId">
                    @for (item of tournamentTeams(); track item.id) {
                      <mat-option [value]="item.id">{{ tournamentTeamLabel(item) }}</mat-option>
                    }
                  </mat-select>
                  @if (form.controls.tournamentTeamId.invalid && form.controls.tournamentTeamId.touched) {
                    <mat-error>Selecciona una inscripcion valida.</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Jugador</mat-label>
                  <mat-select formControlName="playerId">
                    @for (item of players(); track item.id) {
                      <mat-option [value]="item.id">{{ item.firstName }} {{ item.lastName }}</mat-option>
                    }
                  </mat-select>
                  @if (form.controls.playerId.invalid && form.controls.playerId.touched) {
                    <mat-error>Selecciona un jugador valido.</mat-error>
                  }
                </mat-form-field>
              }

              <mat-form-field appearance="outline">
                <mat-label>Numero camiseta</mat-label>
                <input matInput type="number" formControlName="jerseyNumber">
                @if (form.controls.jerseyNumber.hasError('min') || form.controls.jerseyNumber.hasError('max')) {
                  <mat-error>El numero debe estar entre 0 y 99.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Posicion</mat-label>
                <input matInput formControlName="positionName">
                @if (form.controls.positionName.hasError('maxlength')) {
                  <mat-error>La posicion no puede superar 50 caracteres.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="rosterStatus">
                  @for (status of statuses; track status) {
                    <mat-option [value]="status">{{ status }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha inicio</mat-label>
                <input matInput type="date" formControlName="startDate">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha fin</mat-label>
                <input matInput type="date" formControlName="endDate">
                @if (form.hasError('invalidDateRange') && form.controls.endDate.touched) {
                  <mat-error>La fecha fin no puede ser anterior a la fecha inicio.</mat-error>
                }
              </mat-form-field>
            </div>

            <mat-checkbox formControlName="captain">Capitan</mat-checkbox>

            @if (form.hasError('activeRosterWithoutApprovedRegistration')) {
              <p class="muted">Un roster activo requiere una inscripcion aprobada en el torneo.</p>
            }

            <div class="form-actions">
              <a mat-stroked-button routerLink="/rosters">Cancelar</a>
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
export class RosterFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly playersService = inject(PlayersService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly rostersService = inject(RostersService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly rosterId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.rosterId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  private readonly preferredTournamentTeamId = Number(this.route.snapshot.queryParamMap.get('tournamentTeamId') ?? 0);
  private readonly selectedTournamentTeamId = signal(0);
  private readonly selectedRosterStatus = signal<RosterStatus>('ACTIVE');
  protected readonly players = signal<Player[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly statuses: RosterStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  protected readonly selectedTournamentTeam = computed(() =>
    this.tournamentTeams().find((item) => item.id === this.selectedTournamentTeamId()) ?? null
  );
  protected readonly operationalWarning = computed(() => {
    const registration = this.selectedTournamentTeam();
    if (!registration) {
      return '';
    }

    if (registration.registrationStatus !== 'APPROVED' && this.selectedRosterStatus() === 'ACTIVE') {
      return 'La inscripcion seleccionada aun no esta aprobada. No conviene habilitar un roster activo hasta cerrar ese paso.';
    }

    return '';
  });

  protected readonly form = this.fb.nonNullable.group(
    {
      tournamentTeamId: [0, [positiveSelectionValidator('tournamentTeamId')]],
      playerId: [0, [positiveSelectionValidator('playerId')]],
      registrationStatus: [''],
      jerseyNumber: ['', [Validators.min(0), Validators.max(99)]],
      captain: [false],
      positionName: ['', [Validators.maxLength(50)]],
      rosterStatus: ['ACTIVE' as RosterStatus, Validators.required],
      startDate: ['', Validators.required],
      endDate: ['']
    },
    { validators: [dateRangeValidator, rosterOperationalValidator] }
  );

  constructor() {
    this.catalogLoader.loadAll((page, size) => this.playersService.list({ page, size })).subscribe({
      next: (items) => {
        this.players.set(items);
        if (!this.isEditMode() && items.length > 0) {
          this.form.patchValue({ playerId: items[0].id });
        }
      }
    });
    this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })).subscribe({
      next: (items) => this.teams.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.tournamentsService.list({ page, size })).subscribe({
      next: (items) => this.tournaments.set(items)
    });

    this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ page, size })).subscribe({
      next: (items) => {
        this.tournamentTeams.set(items);
        if (!this.isEditMode() && items.length > 0) {
          const preferredRegistration =
            items.find((item) => item.id === this.preferredTournamentTeamId) ?? items[0];
          this.form.patchValue({ tournamentTeamId: preferredRegistration.id });
          this.selectedTournamentTeamId.set(preferredRegistration.id);
        }
        this.syncRegistrationStatus();
      }
    });

    this.form.controls.tournamentTeamId.valueChanges.subscribe(() => {
      this.selectedTournamentTeamId.set(Number(this.form.controls.tournamentTeamId.getRawValue()));
      this.syncRegistrationStatus();
    });
    this.form.controls.rosterStatus.valueChanges.subscribe((value) => {
      this.selectedRosterStatus.set(value);
    });

    if (!this.isEditMode()) {
      this.syncRegistrationStatus();
      this.pageLoading.set(false);
      return;
    }

    this.rostersService
      .getById(this.rosterId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (entry) => {
          this.form.patchValue({
            tournamentTeamId: entry.tournamentTeamId,
            playerId: entry.playerId,
            registrationStatus:
              this.tournamentTeams().find((item) => item.id === entry.tournamentTeamId)?.registrationStatus ?? '',
            jerseyNumber: entry.jerseyNumber !== null ? String(entry.jerseyNumber) : '',
            captain: entry.captain,
            positionName: entry.positionName ?? '',
            rosterStatus: entry.rosterStatus,
            startDate: entry.startDate,
            endDate: entry.endDate ?? ''
          });
          this.selectedTournamentTeamId.set(entry.tournamentTeamId);
          this.selectedRosterStatus.set(entry.rosterStatus);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: RosterFormValue = {
      tournamentTeamId: Number(value.tournamentTeamId),
      playerId: Number(value.playerId),
      jerseyNumber: parseOptionalNumber(value.jerseyNumber),
      captain: value.captain,
      positionName: value.positionName || null,
      rosterStatus: value.rosterStatus,
      startDate: value.startDate,
      endDate: value.endDate || null
    };

    this.saving.set(true);
    const request$ = this.isEditMode()
      ? this.rostersService.update(this.rosterId, {
          jerseyNumber: payload.jerseyNumber,
          captain: payload.captain,
          positionName: payload.positionName,
          rosterStatus: payload.rosterStatus,
          startDate: payload.startDate,
          endDate: payload.endDate
        })
      : this.rostersService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Roster guardado correctamente');
        void this.router.navigateByUrl('/rosters');
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }

  protected tournamentTeamLabel(item: TournamentTeam): string {
    const team = this.teams().find((entry) => entry.id === item.teamId);
    const tournament = this.tournaments().find((entry) => entry.id === item.tournamentId);
    const teamLabel = team?.name ?? `Equipo ${item.teamId}`;
    const tournamentLabel = tournament?.name ?? `Torneo ${item.tournamentId}`;
    return `${teamLabel} / ${tournamentLabel} (#${item.id})`;
  }

  private syncRegistrationStatus(): void {
    const registrationStatus =
      this.tournamentTeams().find((item) => item.id === Number(this.form.controls.tournamentTeamId.getRawValue()))
        ?.registrationStatus ?? '';

    this.form.patchValue({ registrationStatus }, { emitEvent: false });
  }
}
