import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { StageGroup } from '../stage-groups/stage-group.models';
import { StageGroupsService } from '../stage-groups/stage-groups.service';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentStage } from '../tournament-stages/tournament-stage.models';
import { TournamentStagesService } from '../tournament-stages/tournament-stages.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { StandingFormValue, StandingUpdateValue } from './standings.models';
import { StandingsService } from './standings.service';

const positiveSelectionValidator = (fieldName: string): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    return Number(control.value) > 0 ? null : { [fieldName]: true };
  };
};

const metricsValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const played = Number(control.get('played')?.value);
  const wins = Number(control.get('wins')?.value);
  const draws = Number(control.get('draws')?.value);
  const losses = Number(control.get('losses')?.value);
  const pointsFor = Number(control.get('pointsFor')?.value);
  const pointsAgainst = Number(control.get('pointsAgainst')?.value);
  const scoreDiff = Number(control.get('scoreDiff')?.value);

  if (wins + draws + losses !== played) {
    return { invalidRecord: true };
  }

  if (scoreDiff !== pointsFor - pointsAgainst) {
    return { invalidScoreDiff: true };
  }

  return null;
};

const parseOptionalNumber = (value: string | number | null | undefined): number | null => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

@Component({
  selector: 'app-standing-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header
        [title]="isEditMode() ? 'Editar standing' : 'Nuevo standing'"
        [subtitle]="pageSubtitle()"
      />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <div class="context-banner">
              <strong>Contrato operativo</strong>
              <span class="muted">
                El recalculo automatico sigue disponible en la tabla. Este formulario cubre el CRUD directo de /standings.
              </span>
            </div>

            <div class="form-grid">
              @if (!isEditMode()) {
                <mat-form-field appearance="outline">
                  <mat-label>Torneo</mat-label>
                  <mat-select formControlName="tournamentId">
                    @for (item of tournaments(); track item.id) {
                      <mat-option [value]="item.id">{{ item.name }}</mat-option>
                    }
                  </mat-select>
                  @if (form.controls.tournamentId.invalid && form.controls.tournamentId.touched) {
                    <mat-error>Selecciona un torneo valido.</mat-error>
                  }
                </mat-form-field>
              }

              <mat-form-field appearance="outline">
                <mat-label>Etapa</mat-label>
                <mat-select formControlName="stageId">
                  <mat-option value="">Sin etapa</mat-option>
                  @for (item of stages(); track item.id) {
                    <mat-option [value]="item.id">{{ item.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Grupo</mat-label>
                <mat-select formControlName="groupId">
                  <mat-option value="">Sin grupo</mat-option>
                  @for (item of groups(); track item.id) {
                    <mat-option [value]="item.id">{{ item.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

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
                <mat-label>Jugados</mat-label>
                <input matInput type="number" formControlName="played">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Ganados</mat-label>
                <input matInput type="number" formControlName="wins">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Empatados</mat-label>
                <input matInput type="number" formControlName="draws">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Perdidos</mat-label>
                <input matInput type="number" formControlName="losses">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Puntos a favor</mat-label>
                <input matInput type="number" formControlName="pointsFor">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Puntos en contra</mat-label>
                <input matInput type="number" formControlName="pointsAgainst">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Diferencia</mat-label>
                <input matInput type="number" formControlName="scoreDiff">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Puntos</mat-label>
                <input matInput type="number" formControlName="points">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Posicion</mat-label>
                <input matInput type="number" formControlName="rankPosition">
              </mat-form-field>
            </div>

            @if (form.hasError('invalidRecord')) {
              <p class="muted">Ganados + empatados + perdidos debe ser igual a partidos jugados.</p>
            }
            @if (form.hasError('invalidScoreDiff')) {
              <p class="muted">La diferencia debe ser puntos a favor menos puntos en contra.</p>
            }

            <div class="form-actions">
              <a mat-stroked-button routerLink="/standings">Cancelar</a>
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
export class StandingFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly standingsService = inject(StandingsService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly standingId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.standingId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly tournaments = signal<Tournament[]>([]);
  private readonly teams = signal<Team[]>([]);
  private readonly allStages = signal<TournamentStage[]>([]);
  private readonly allGroups = signal<StageGroup[]>([]);
  private readonly allTournamentTeams = signal<TournamentTeam[]>([]);
  private readonly selectedTournamentId = signal(0);
  private readonly selectedStageId = signal(0);
  protected readonly pageSubtitle = computed(() => {
    const labels = [
      this.tournamentName(this.selectedTournamentId()),
      this.stageName(this.selectedStageId()),
      this.groupName(Number(this.form.controls.groupId.getRawValue()))
    ].filter((item) => Boolean(item));

    return labels.length > 0 ? labels.join(' / ') : 'Registro operativo de tabla contra /standings.';
  });
  protected readonly stages = computed(() => {
    const tournamentId = this.selectedTournamentId();
    return tournamentId ? this.allStages().filter((item) => item.tournamentId === tournamentId) : this.allStages();
  });
  protected readonly groups = computed(() => {
    const stageId = this.selectedStageId();
    return stageId ? this.allGroups().filter((item) => item.stageId === stageId) : [];
  });
  protected readonly tournamentTeams = computed(() => {
    const tournamentId = this.selectedTournamentId();
    const registrations = this.allTournamentTeams().filter((item) => item.registrationStatus === 'APPROVED');
    return tournamentId ? registrations.filter((item) => item.tournamentId === tournamentId) : registrations;
  });

  protected readonly form = this.fb.nonNullable.group(
    {
      tournamentId: [0, [positiveSelectionValidator('tournamentId')]],
      stageId: ['' as number | ''],
      groupId: ['' as number | ''],
      tournamentTeamId: [0, [positiveSelectionValidator('tournamentTeamId')]],
      played: [0, [Validators.required, Validators.min(0)]],
      wins: [0, [Validators.required, Validators.min(0)]],
      draws: [0, [Validators.required, Validators.min(0)]],
      losses: [0, [Validators.required, Validators.min(0)]],
      pointsFor: [0, [Validators.required, Validators.min(0)]],
      pointsAgainst: [0, [Validators.required, Validators.min(0)]],
      scoreDiff: [0, [Validators.required]],
      points: [0, [Validators.required, Validators.min(0)]],
      rankPosition: ['' as number | '', [Validators.min(1)]]
    },
    { validators: [metricsValidator] }
  );

  constructor() {
    this.catalogLoader.loadAll((page, size) => this.tournamentsService.list({ page, size })).subscribe({
      next: (items) => {
        this.tournaments.set(items);
        if (!this.isEditMode() && items.length > 0) {
          this.form.patchValue({ tournamentId: items[0].id });
          this.selectedTournamentId.set(items[0].id);
        }
      }
    });
    this.catalogLoader.loadAll((page, size) => this.stagesService.list({ page, size })).subscribe({
      next: (items) => this.allStages.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.groupsService.list({ page, size })).subscribe({
      next: (items) => this.allGroups.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })).subscribe({
      next: (items) => this.teams.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ page, size })).subscribe({
      next: (items) => {
        this.allTournamentTeams.set(items);
        if (!this.isEditMode()) {
          this.applyDefaultRegistration(Number(this.form.controls.tournamentId.getRawValue()));
        }
      }
    });

    this.form.controls.tournamentId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const tournamentId = Number(value);
      this.selectedTournamentId.set(tournamentId);
      const validStageIds = new Set(this.allStages().filter((item) => item.tournamentId === tournamentId).map((item) => item.id));
      const validRegistrationIds = new Set(
        this.allTournamentTeams()
          .filter((item) => item.tournamentId === tournamentId && item.registrationStatus === 'APPROVED')
          .map((item) => item.id)
      );
      const currentStageId = Number(this.form.controls.stageId.getRawValue());
      const currentRegistrationId = Number(this.form.controls.tournamentTeamId.getRawValue());

      this.form.patchValue(
        {
          stageId: currentStageId && validStageIds.has(currentStageId) ? currentStageId : '',
          groupId: '',
          tournamentTeamId: currentRegistrationId && validRegistrationIds.has(currentRegistrationId) ? currentRegistrationId : 0
        },
        { emitEvent: false }
      );

      if (!this.isEditMode()) {
        this.applyDefaultRegistration(tournamentId);
      }
    });

    this.form.controls.stageId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const stageId = Number(value);
      this.selectedStageId.set(stageId);
      const validGroupIds = new Set(this.allGroups().filter((item) => item.stageId === stageId).map((item) => item.id));
      const currentGroupId = Number(this.form.controls.groupId.getRawValue());

      if (currentGroupId && !validGroupIds.has(currentGroupId)) {
        this.form.patchValue({ groupId: '' }, { emitEvent: false });
      }
    });

    if (!this.isEditMode()) {
      this.pageLoading.set(false);
      return;
    }

    this.standingsService
      .getById(this.standingId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (standing) => {
          this.form.patchValue({
            tournamentId: standing.tournamentId,
            stageId: standing.stageId ?? '',
            groupId: standing.groupId ?? '',
            tournamentTeamId: standing.tournamentTeamId,
            played: standing.played,
            wins: standing.wins,
            draws: standing.draws,
            losses: standing.losses,
            pointsFor: standing.pointsFor,
            pointsAgainst: standing.pointsAgainst,
            scoreDiff: standing.scoreDiff,
            points: standing.points,
            rankPosition: standing.rankPosition ?? ''
          });
          this.selectedTournamentId.set(standing.tournamentId);
          this.selectedStageId.set(standing.stageId ?? 0);
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
    const payload: StandingFormValue = {
      tournamentId: Number(value.tournamentId),
      stageId: parseOptionalNumber(value.stageId),
      groupId: parseOptionalNumber(value.groupId),
      tournamentTeamId: Number(value.tournamentTeamId),
      played: Number(value.played),
      wins: Number(value.wins),
      draws: Number(value.draws),
      losses: Number(value.losses),
      pointsFor: Number(value.pointsFor),
      pointsAgainst: Number(value.pointsAgainst),
      scoreDiff: Number(value.scoreDiff),
      points: Number(value.points),
      rankPosition: parseOptionalNumber(value.rankPosition)
    };

    const updatePayload: StandingUpdateValue = {
      stageId: payload.stageId,
      groupId: payload.groupId,
      tournamentTeamId: payload.tournamentTeamId,
      played: payload.played,
      wins: payload.wins,
      draws: payload.draws,
      losses: payload.losses,
      pointsFor: payload.pointsFor,
      pointsAgainst: payload.pointsAgainst,
      scoreDiff: payload.scoreDiff,
      points: payload.points,
      rankPosition: payload.rankPosition
    };

    this.saving.set(true);
    const request$ = this.isEditMode()
      ? this.standingsService.update(this.standingId, updatePayload)
      : this.standingsService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Standing guardado correctamente');
        void this.router.navigateByUrl('/standings');
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

  private applyDefaultRegistration(tournamentId: number): void {
    if (!tournamentId || Number(this.form.controls.tournamentTeamId.getRawValue()) > 0) {
      return;
    }

    const registration = this.allTournamentTeams().find(
      (item) => item.tournamentId === tournamentId && item.registrationStatus === 'APPROVED'
    );
    if (registration) {
      this.form.patchValue({ tournamentTeamId: registration.id }, { emitEvent: false });
    }
  }

  private tournamentName(id: number): string {
    if (!id) {
      return '';
    }

    return this.tournaments().find((item) => item.id === id)?.name ?? `Torneo ${id}`;
  }

  private stageName(id: number): string {
    if (!id) {
      return '';
    }

    return this.allStages().find((item) => item.id === id)?.name ?? `Etapa ${id}`;
  }

  private groupName(id: number): string {
    if (!id) {
      return '';
    }

    return this.allGroups().find((item) => item.id === id)?.name ?? `Grupo ${id}`;
  }
}
