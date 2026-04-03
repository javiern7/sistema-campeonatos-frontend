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
import { toDateTimeLocalInputValue, toIsoFromDateTimeLocalInput } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { RosterEntry } from '../rosters/roster.models';
import { RostersService } from '../rosters/rosters.service';
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
import { MatchFormValue, MatchStatus } from './match.models';
import { MatchesService } from './matches.service';

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

const matchConsistencyValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const tournamentId = Number(control.get('tournamentId')?.value);
  const homeTeamId = Number(control.get('homeTournamentTeamId')?.value);
  const awayTeamId = Number(control.get('awayTournamentTeamId')?.value);
  const winnerTeamId = Number(control.get('winnerTournamentTeamId')?.value);
  const homeTeamTournamentId = Number(control.get('homeTeamTournamentId')?.value);
  const awayTeamTournamentId = Number(control.get('awayTeamTournamentId')?.value);
  const status = control.get('status')?.value as MatchStatus;
  const homeScoreValue = control.get('homeScore')?.value;
  const awayScoreValue = control.get('awayScore')?.value;
  const hasHomeScore = homeScoreValue !== '' && homeScoreValue !== null;
  const hasAwayScore = awayScoreValue !== '' && awayScoreValue !== null;

  if (homeTeamId > 0 && awayTeamId > 0 && homeTeamId === awayTeamId) {
    return { sameTeams: true };
  }

  if (winnerTeamId && winnerTeamId !== homeTeamId && winnerTeamId !== awayTeamId) {
    return { invalidWinner: true };
  }

  if (
    tournamentId > 0 &&
    ((homeTeamId > 0 && homeTeamTournamentId > 0 && homeTeamTournamentId !== tournamentId) ||
      (awayTeamId > 0 && awayTeamTournamentId > 0 && awayTeamTournamentId !== tournamentId))
  ) {
    return { invalidTournamentTeams: true };
  }

  if ((hasHomeScore && !hasAwayScore) || (!hasHomeScore && hasAwayScore)) {
    return { incompleteScore: true };
  }

  if (status === 'PLAYED' && (!hasHomeScore || !hasAwayScore)) {
    return { playedMatchWithoutScore: true };
  }

  return null;
};

@Component({
  selector: 'app-match-form-page',
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
        [title]="isEditMode() ? 'Editar partido' : 'Nuevo partido'"
        [subtitle]="pageSubtitle()"
      />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            @if (readinessWarning()) {
              <div class="context-banner">
                <strong>Auditoria Sprint 7</strong>
                <span class="muted">{{ readinessWarning() }}</span>
              </div>
            }

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
                <mat-label>Equipo local</mat-label>
                <mat-select formControlName="homeTournamentTeamId">
                  @for (item of tournamentTeams(); track item.id) {
                    <mat-option [value]="item.id">{{ tournamentTeamLabel(item) }}</mat-option>
                  }
                </mat-select>
                @if (form.controls.homeTournamentTeamId.invalid && form.controls.homeTournamentTeamId.touched) {
                  <mat-error>Selecciona un equipo local valido.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Equipo visita</mat-label>
                <mat-select formControlName="awayTournamentTeamId">
                  @for (item of tournamentTeams(); track item.id) {
                    <mat-option [value]="item.id">{{ tournamentTeamLabel(item) }}</mat-option>
                  }
                </mat-select>
                @if (form.controls.awayTournamentTeamId.invalid && form.controls.awayTournamentTeamId.touched) {
                  <mat-error>Selecciona un equipo visita valido.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Estado</mat-label>
                <mat-select formControlName="status">
                  @for (status of statuses; track status) {
                    <mat-option [value]="status">{{ statusLabel(status) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Ronda</mat-label>
                <input matInput type="number" formControlName="roundNumber">
                @if (form.controls.roundNumber.hasError('min')) {
                  <mat-error>La ronda debe ser mayor a 0.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha de juego</mat-label>
                <input matInput type="number" formControlName="matchdayNumber">
                @if (form.controls.matchdayNumber.hasError('min')) {
                  <mat-error>La fecha de juego debe ser mayor a 0.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha y hora</mat-label>
                <input matInput type="datetime-local" formControlName="scheduledAt">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Sede</mat-label>
                <input matInput formControlName="venueName">
                @if (form.controls.venueName.hasError('maxlength')) {
                  <mat-error>La sede no puede superar 150 caracteres.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Marcador local</mat-label>
                <input matInput type="number" formControlName="homeScore">
                @if (form.controls.homeScore.hasError('min')) {
                  <mat-error>El score no puede ser negativo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Marcador visita</mat-label>
                <input matInput type="number" formControlName="awayScore">
                @if (form.controls.awayScore.hasError('min')) {
                  <mat-error>El score no puede ser negativo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Ganador</mat-label>
                <mat-select formControlName="winnerTournamentTeamId">
                  <mat-option value="">Sin definir</mat-option>
                  @for (item of winnerOptions(); track item.id) {
                    <mat-option [value]="item.id">{{ tournamentTeamLabel(item) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Notas</mat-label>
                <textarea matInput rows="3" formControlName="notes"></textarea>
              </mat-form-field>
            </div>

            @if (form.hasError('sameTeams')) {
              <p class="muted">El equipo local y visita no pueden ser el mismo.</p>
            }
            @if (form.hasError('invalidWinner')) {
              <p class="muted">El ganador debe coincidir con uno de los equipos del partido.</p>
            }
            @if (form.hasError('invalidTournamentTeams')) {
              <p class="muted">Los equipos seleccionados deben pertenecer al torneo activo.</p>
            }
            @if (form.hasError('incompleteScore')) {
              <p class="muted">Si informas un score, debes completar ambos marcadores.</p>
            }
            @if (form.hasError('playedMatchWithoutScore')) {
              <p class="muted">Un partido en estado jugado debe tener marcador local y visita.</p>
            }

            <div class="form-actions">
              <a mat-stroked-button routerLink="/matches">Cancelar</a>
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
export class MatchFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly rostersService = inject(RostersService);
  private readonly matchesService = inject(MatchesService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly matchId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.matchId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  private readonly selectedTournamentId = signal(0);
  private readonly selectedStageId = signal(0);
  private readonly selectedHomeTournamentTeamId = signal(0);
  private readonly selectedAwayTournamentTeamId = signal(0);
  protected readonly tournaments = signal<Tournament[]>([]);
  private readonly teams = signal<Team[]>([]);
  private readonly allStages = signal<TournamentStage[]>([]);
  private readonly allGroups = signal<StageGroup[]>([]);
  private readonly allTournamentTeams = signal<TournamentTeam[]>([]);
  private readonly allRosters = signal<RosterEntry[]>([]);
  protected readonly statuses: MatchStatus[] = ['SCHEDULED', 'PLAYED', 'FORFEIT', 'CANCELLED'];
  protected readonly pageSubtitle = computed(() => {
    const tournamentId = this.selectedTournamentId();
    const stageId = this.selectedStageId();
    const groupId = Number(this.form.controls.groupId.getRawValue());
    const parts = [this.tournamentName(tournamentId), this.stageName(stageId), this.groupName(groupId)].filter((item) =>
      Boolean(item)
    );

    return parts.length > 0 ? parts.join(' / ') : 'Programa el fixture y registra resultados con contexto competitivo.';
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
    return tournamentId
      ? this.allTournamentTeams().filter((item) => item.tournamentId === tournamentId)
      : this.allTournamentTeams();
  });
  protected readonly winnerOptions = computed(() => {
    const selectedIds = new Set([
      this.selectedHomeTournamentTeamId(),
      this.selectedAwayTournamentTeamId()
    ]);

    return this.tournamentTeams().filter((item) => selectedIds.has(item.id));
  });
  protected readonly rosterReadyTournamentTeamIds = computed(() => {
    const activeRosterIds = new Set(
      this.allRosters()
        .filter((item) => item.rosterStatus === 'ACTIVE')
        .map((item) => item.tournamentTeamId)
    );

    return new Set(
      this.tournamentTeams()
        .filter((item) => item.registrationStatus === 'APPROVED' && activeRosterIds.has(item.id))
        .map((item) => item.id)
    );
  });
  protected readonly selectedTeamsRosterReady = computed(() => {
    const activeIds = this.rosterReadyTournamentTeamIds();
    const homeId = this.selectedHomeTournamentTeamId();
    const awayId = this.selectedAwayTournamentTeamId();

    if (!homeId || !awayId) {
      return true;
    }

    return activeIds.has(homeId) && activeIds.has(awayId);
  });
  protected readonly readinessWarning = computed(() => {
    const tournamentId = this.selectedTournamentId();
    const approvedCount = this.tournamentTeams().filter((item) => item.registrationStatus === 'APPROVED').length;
    const rosterReadyCount = this.rosterReadyTournamentTeamIds().size;

    if (!tournamentId) {
      return '';
    }

    if (approvedCount === 0) {
      return 'Este torneo aun no tiene inscripciones aprobadas. Completa ese paso antes de programar competencia.';
    }

    if (rosterReadyCount < 2) {
      return `Solo ${rosterReadyCount} inscripciones aprobadas tienen roster activo. Se recomienda no avanzar a partidos hasta llegar al menos a 2.`;
    }

    return '';
  });

  protected readonly form = this.fb.nonNullable.group(
    {
      tournamentId: [0],
      stageId: [''],
      groupId: [''],
      roundNumber: ['', [Validators.min(1)]],
      matchdayNumber: ['', [Validators.min(1)]],
      homeTournamentTeamId: [0, [positiveSelectionValidator('homeTournamentTeamId')]],
      awayTournamentTeamId: [0, [positiveSelectionValidator('awayTournamentTeamId')]],
      homeTeamTournamentId: [0],
      awayTeamTournamentId: [0],
      scheduledAt: [''],
      venueName: ['', [Validators.maxLength(150)]],
      status: ['SCHEDULED' as MatchStatus, Validators.required],
      homeScore: ['', [Validators.min(0)]],
      awayScore: ['', [Validators.min(0)]],
      winnerTournamentTeamId: [''],
      notes: ['']
    },
    { validators: [matchConsistencyValidator] }
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
          this.applyDefaultTeamsForTournament(Number(this.form.controls.tournamentId.getRawValue()));
        }
      }
    });
    this.catalogLoader.loadAll((page, size) => this.rostersService.list({ page, size })).subscribe({
      next: (items) => this.allRosters.set(items)
    });

    this.form.controls.tournamentId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const tournamentId = Number(value);
      this.selectedTournamentId.set(tournamentId);
      const validStageIds = new Set(this.allStages().filter((item) => item.tournamentId === tournamentId).map((item) => item.id));
      const validTeamIds = new Set(
        this.allTournamentTeams().filter((item) => item.tournamentId === tournamentId).map((item) => item.id)
      );
      const currentStageId = Number(this.form.controls.stageId.getRawValue());
      const currentHomeTeamId = Number(this.form.controls.homeTournamentTeamId.getRawValue());
      const currentAwayTeamId = Number(this.form.controls.awayTournamentTeamId.getRawValue());
      const currentWinnerTeamId = Number(this.form.controls.winnerTournamentTeamId.getRawValue());

      this.form.patchValue(
        {
          stageId: currentStageId && validStageIds.has(currentStageId) ? String(currentStageId) : '',
          groupId: '',
          homeTournamentTeamId: validTeamIds.has(currentHomeTeamId) ? currentHomeTeamId : 0,
          awayTournamentTeamId: validTeamIds.has(currentAwayTeamId) ? currentAwayTeamId : 0,
          winnerTournamentTeamId: validTeamIds.has(currentWinnerTeamId) ? String(currentWinnerTeamId) : ''
        },
        { emitEvent: false }
      );

      if (!this.isEditMode()) {
        this.applyDefaultTeamsForTournament(tournamentId);
      }
      this.syncSelectedTeamTournamentIds();
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

    this.form.controls.homeTournamentTeamId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncSelectedTeamTournamentIds();
      this.syncWinnerSelection();
    });

    this.form.controls.awayTournamentTeamId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncSelectedTeamTournamentIds();
      this.syncWinnerSelection();
    });

    if (!this.isEditMode()) {
      this.syncSelectedTeamTournamentIds();
      this.pageLoading.set(false);
      return;
    }

    this.matchesService
      .getById(this.matchId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (match) => {
          this.form.patchValue({
            tournamentId: match.tournamentId,
            stageId: match.stageId ? String(match.stageId) : '',
            groupId: match.groupId ? String(match.groupId) : '',
            roundNumber: match.roundNumber ? String(match.roundNumber) : '',
            matchdayNumber: match.matchdayNumber ? String(match.matchdayNumber) : '',
            homeTournamentTeamId: match.homeTournamentTeamId,
            awayTournamentTeamId: match.awayTournamentTeamId,
            scheduledAt: toDateTimeLocalInputValue(match.scheduledAt),
            venueName: match.venueName ?? '',
            status: match.status,
            homeScore: match.homeScore !== null ? String(match.homeScore) : '',
            awayScore: match.awayScore !== null ? String(match.awayScore) : '',
            winnerTournamentTeamId: match.winnerTournamentTeamId ? String(match.winnerTournamentTeamId) : '',
            notes: match.notes ?? ''
          });
          this.selectedTournamentId.set(match.tournamentId);
          this.selectedStageId.set(match.stageId ?? 0);
          this.syncSelectedTeamTournamentIds();
          this.syncWinnerSelection();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) {
      return;
    }

    const status = this.form.controls.status.getRawValue();
    if ((status === 'SCHEDULED' || status === 'PLAYED' || status === 'FORFEIT') && this.rosterReadyTournamentTeamIds().size < 2) {
      this.notifications.error(
        'El torneo no tiene base suficiente de roster activo para avanzar a competencia. Revisa inscripciones aprobadas y rosters antes de guardar.'
      );
      return;
    }

    if ((status === 'SCHEDULED' || status === 'PLAYED' || status === 'FORFEIT') && !this.selectedTeamsRosterReady()) {
      this.notifications.error(
        'Los equipos seleccionados deben tener roster activo para avanzar a competencia. Revisa las inscripciones elegidas antes de guardar.'
      );
      return;
    }

    const value = this.form.getRawValue();
    const payload: MatchFormValue = {
      tournamentId: Number(value.tournamentId),
      stageId: parseOptionalNumber(value.stageId),
      groupId: parseOptionalNumber(value.groupId),
      roundNumber: parseOptionalNumber(value.roundNumber),
      matchdayNumber: parseOptionalNumber(value.matchdayNumber),
      homeTournamentTeamId: Number(value.homeTournamentTeamId),
      awayTournamentTeamId: Number(value.awayTournamentTeamId),
      scheduledAt: toIsoFromDateTimeLocalInput(value.scheduledAt),
      venueName: value.venueName || null,
      status: value.status,
      homeScore: parseOptionalNumber(value.homeScore),
      awayScore: parseOptionalNumber(value.awayScore),
      winnerTournamentTeamId: parseOptionalNumber(value.winnerTournamentTeamId),
      notes: value.notes || null
    };

    this.saving.set(true);
    const request$ = this.isEditMode()
      ? this.matchesService.update(this.matchId, {
          stageId: payload.stageId,
          groupId: payload.groupId,
          roundNumber: payload.roundNumber,
          matchdayNumber: payload.matchdayNumber,
          homeTournamentTeamId: payload.homeTournamentTeamId,
          awayTournamentTeamId: payload.awayTournamentTeamId,
          scheduledAt: payload.scheduledAt,
          venueName: payload.venueName,
          status: payload.status,
          homeScore: payload.homeScore,
          awayScore: payload.awayScore,
          winnerTournamentTeamId: payload.winnerTournamentTeamId,
          notes: payload.notes
        })
      : this.matchesService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Partido guardado correctamente');
        void this.router.navigateByUrl('/matches');
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

  protected tournamentName(id: number): string {
    if (!id) {
      return '';
    }

    return this.tournaments().find((item) => item.id === id)?.name ?? `Torneo ${id}`;
  }

  protected stageName(id: number): string {
    if (!id) {
      return '';
    }

    return this.allStages().find((item) => item.id === id)?.name ?? `Etapa ${id}`;
  }

  protected groupName(id: number): string {
    if (!id) {
      return '';
    }

    return this.allGroups().find((item) => item.id === id)?.name ?? `Grupo ${id}`;
  }

  protected statusLabel(status: MatchStatus): string {
    const labels: Record<MatchStatus, string> = {
      SCHEDULED: 'Programado',
      PLAYED: 'Jugado',
      FORFEIT: 'Forfeit',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  private applyDefaultTeamsForTournament(tournamentId: number): void {
    if (!tournamentId) {
      return;
    }

    const currentHomeTeamId = Number(this.form.controls.homeTournamentTeamId.getRawValue());
    const currentAwayTeamId = Number(this.form.controls.awayTournamentTeamId.getRawValue());
    if (currentHomeTeamId > 0 || currentAwayTeamId > 0) {
      return;
    }

    const teams = this.allTournamentTeams().filter((item) => item.tournamentId === tournamentId);
    if (teams.length < 2) {
      return;
    }

    const approvedWithActiveRoster = teams.filter((item) => this.rosterReadyTournamentTeamIds().has(item.id));
    const preferredTeams = approvedWithActiveRoster.length >= 2 ? approvedWithActiveRoster : teams;

    this.form.patchValue(
      {
        homeTournamentTeamId: preferredTeams[0]?.id ?? 0,
        awayTournamentTeamId: preferredTeams[1]?.id ?? 0
      },
      { emitEvent: false }
    );
    this.syncSelectedTeamTournamentIds();
  }

  private syncSelectedTeamTournamentIds(): void {
    const homeTeamId = Number(this.form.controls.homeTournamentTeamId.getRawValue());
    const awayTeamId = Number(this.form.controls.awayTournamentTeamId.getRawValue());
    this.selectedHomeTournamentTeamId.set(homeTeamId);
    this.selectedAwayTournamentTeamId.set(awayTeamId);
    const homeTournamentId = this.allTournamentTeams().find((item) => item.id === homeTeamId)?.tournamentId ?? 0;
    const awayTournamentId = this.allTournamentTeams().find((item) => item.id === awayTeamId)?.tournamentId ?? 0;

    this.form.patchValue(
      {
        homeTeamTournamentId: homeTournamentId,
        awayTeamTournamentId: awayTournamentId
      },
      { emitEvent: false }
    );
  }

  private syncWinnerSelection(): void {
    const winnerId = Number(this.form.controls.winnerTournamentTeamId.getRawValue());
    const homeId = this.selectedHomeTournamentTeamId();
    const awayId = this.selectedAwayTournamentTeamId();

    if (winnerId && winnerId !== homeId && winnerId !== awayId) {
      this.form.patchValue({ winnerTournamentTeamId: '' }, { emitEvent: false });
    }
  }
}
