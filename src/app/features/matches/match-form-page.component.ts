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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule } from '@angular/material/core';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { parseBackendDate, PICHANGA_DATE_PICKER_PROVIDERS, toBackendDate } from '../../shared/date/date-only.utils';
import { toIsoFromDateAndTime, toTimeInputValue } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SearchSelectComponent } from '../../shared/search-select/search-select.component';
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

type TeamRosterReadiness = {
  label: string;
  activeCount: number;
  validCount: number;
  futureCount: number;
  expiredCount: number;
  hasRosterForMatchDate: boolean;
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

  if (hasHomeScore && hasAwayScore && Number(homeScoreValue) === Number(awayScoreValue) && winnerTeamId) {
    return { drawWithWinner: true };
  }

  const scheduledDate = control.get('scheduledDate')?.value as Date | null;
  const scheduledTime = String(control.get('scheduledTime')?.value ?? '').trim();
  if ((scheduledDate && !scheduledTime) || (!scheduledDate && !!scheduledTime)) {
    return { incompleteScheduledAt: true };
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
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent,
    SearchSelectComponent
  ],
  providers: PICHANGA_DATE_PICKER_PROVIDERS,
  template: `
    <section class="app-page">
      <app-page-header
        [title]="isEditMode() ? 'Registrar resultado del partido' : 'Programar partido'"
        [subtitle]="pageSubtitle()"
      >
        @if (selectedTournamentId()) {
          <a mat-stroked-button [routerLink]="['/tournaments', selectedTournamentId()]">Volver al campeonato</a>
        }
        <a mat-stroked-button routerLink="/matches" [queryParams]="{ tournamentId: selectedTournamentId() || '' }">Volver a partidos</a>
      </app-page-header>

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            @if (readinessWarning()) {
              <div class="context-banner">
                <strong>Validacion del campeonato</strong>
                <span class="muted">{{ readinessWarning() }}</span>
              </div>
            }

            <section class="form-section">
              <div class="form-section-heading">
                <h2>Campeonato y fase</h2>
                <p class="muted">Ubica el partido dentro del campeonato, etapa y grupo correspondiente.</p>
              </div>

              <div class="form-grid">
              @if (!isEditMode()) {
                <app-search-select
                  formControlName="tournamentId"
                  label="Campeonato"
                  placeholder="Busca un campeonato"
                  [options]="tournaments()"
                  [labelFn]="tournamentOptionLabel"
                  [searchTextFn]="tournamentOptionLabel"
                />
              }

              <app-search-select
                formControlName="stageId"
                label="Etapa"
                placeholder="Busca una etapa"
                [options]="stages()"
                [labelFn]="stageOptionLabel"
                [searchTextFn]="stageOptionLabel"
                emptyOptionLabel="Sin etapa"
              />

              <app-search-select
                formControlName="groupId"
                label="Grupo"
                placeholder="Busca un grupo"
                [options]="groups()"
                [labelFn]="groupOptionLabel"
                [searchTextFn]="groupOptionLabel"
                emptyOptionLabel="Sin grupo"
              />
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-heading">
                <h2>Equipos</h2>
                <p class="muted">Selecciona los participantes del partido. Ambos deben estar inscritos en el campeonato.</p>
              </div>

              <div class="form-grid">
              <app-search-select
                formControlName="homeTournamentTeamId"
                label="Equipo local"
                placeholder="Busca un equipo local"
                [options]="tournamentTeams()"
                [labelFn]="tournamentTeamOptionLabel"
                [searchTextFn]="tournamentTeamOptionLabel"
                [showError]="form.controls.homeTournamentTeamId.invalid && form.controls.homeTournamentTeamId.touched"
                errorText="Selecciona un equipo local valido."
              />

              <app-search-select
                formControlName="awayTournamentTeamId"
                label="Equipo visita"
                placeholder="Busca un equipo visita"
                [options]="tournamentTeams()"
                [labelFn]="tournamentTeamOptionLabel"
                [searchTextFn]="tournamentTeamOptionLabel"
                [showError]="form.controls.awayTournamentTeamId.invalid && form.controls.awayTournamentTeamId.touched"
                errorText="Selecciona un equipo visita valido."
              />
              </div>

              @if (selectedRosterReadinessMessage()) {
                <div class="context-banner">
                  <strong>Planteles para este partido</strong>
                  <span class="muted">{{ selectedRosterReadinessMessage() }}</span>
                  <a
                    mat-stroked-button
                    routerLink="/rosters"
                    [queryParams]="{ rosterStatus: 'ACTIVE' }"
                  >
                    Revisar planteles
                  </a>
                </div>
              }
            </section>

            <section class="form-section">
              <div class="form-section-heading">
                <h2>Fecha y lugar</h2>
                <p class="muted">Programa el encuentro para que el calendario sea claro para el organizador.</p>
              </div>

              <div class="form-grid">
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
                <mat-label>Fecha</mat-label>
                <input
                  matInput
                  [matDatepicker]="scheduledDatePicker"
                  formControlName="scheduledDate"
                  placeholder="dd/mm/aaaa"
                >
                <mat-datepicker-toggle matIconSuffix [for]="scheduledDatePicker" />
                <mat-datepicker #scheduledDatePicker />
                <mat-hint>dd/mm/aaaa</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Hora</mat-label>
                <input matInput type="time" formControlName="scheduledTime">
                <mat-hint>hh:mm</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Sede</mat-label>
                <input matInput formControlName="venueName">
                @if (form.controls.venueName.hasError('maxlength')) {
                  <mat-error>La sede no puede superar 150 caracteres.</mat-error>
                }
              </mat-form-field>
              </div>
            </section>

            <section class="form-section result-section">
              <div class="form-section-heading">
                <h2>Resultado y estado</h2>
                <p class="muted">Usa esta seccion para cerrar el partido, registrar marcador o marcar una ausencia/cancelacion.</p>
              </div>

              <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Estado del partido</mat-label>
                <mat-select formControlName="status">
                  @for (status of statuses; track status) {
                    <mat-option [value]="status">{{ statusLabel(status) }}</mat-option>
                  }
                </mat-select>
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

              <app-search-select
                formControlName="winnerTournamentTeamId"
                label="Ganador"
                placeholder="Busca un ganador"
                [options]="winnerOptions()"
                [labelFn]="tournamentTeamOptionLabel"
                [searchTextFn]="tournamentTeamOptionLabel"
                [emptyOptionLabel]="winnerEmptyLabel()"
                [hint]="winnerEmptyLabel() === 'Empate' ? 'Con marcador igualado, el partido queda sin ganador.' : ''"
              />

              <mat-form-field appearance="outline">
                <mat-label>Notas</mat-label>
                <textarea matInput rows="3" formControlName="notes"></textarea>
              </mat-form-field>
              </div>
            </section>

            @if (form.hasError('sameTeams')) {
              <p class="muted">El equipo local y visita no pueden ser el mismo.</p>
            }
            @if (form.hasError('invalidWinner')) {
              <p class="muted">El ganador debe coincidir con uno de los equipos del partido.</p>
            }
            @if (form.hasError('invalidTournamentTeams')) {
              <p class="muted">Los equipos seleccionados deben pertenecer al campeonato activo.</p>
            }
            @if (form.hasError('incompleteScore')) {
              <p class="muted">Si informas un score, debes completar ambos marcadores.</p>
            }
            @if (form.hasError('playedMatchWithoutScore')) {
              <p class="muted">Un partido en estado jugado debe tener marcador local y visita.</p>
            }
            @if (form.hasError('drawWithWinner')) {
              <p class="muted">Si el marcador termina empatado, el ganador debe quedar como Empate.</p>
            }
            @if (form.hasError('incompleteScheduledAt')) {
              <p class="muted">Completa fecha y hora juntas para programar el partido.</p>
            }

            <div class="form-actions">
              <a mat-stroked-button routerLink="/matches" [queryParams]="{ tournamentId: selectedTournamentId() || '' }">Cancelar</a>
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Guardando...' : isEditMode() ? 'Guardar resultado' : 'Guardar partido' }}
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

      .result-section {
        border-color: rgba(10, 107, 88, 0.22);
        background: linear-gradient(135deg, rgba(10, 107, 88, 0.08), rgba(255, 255, 255, 0.72));
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
  protected readonly selectedTournamentId = signal(0);
  private readonly selectedStageId = signal(0);
  private readonly selectedHomeTournamentTeamId = signal(0);
  private readonly selectedAwayTournamentTeamId = signal(0);
  private readonly selectedScheduledDate = signal<string | null>(null);
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
  protected readonly winnerEmptyLabel = computed(() => {
    const homeScoreValue = this.form.controls.homeScore.getRawValue();
    const awayScoreValue = this.form.controls.awayScore.getRawValue();
    const hasHomeScore = homeScoreValue !== '' && homeScoreValue !== null;
    const hasAwayScore = awayScoreValue !== '' && awayScoreValue !== null;

    if (hasHomeScore && hasAwayScore && Number(homeScoreValue) === Number(awayScoreValue)) {
      return 'Empate';
    }

    return 'Sin definir';
  });
  protected readonly rosterReadyTournamentTeamIds = computed(() => {
    const activeRosterIds = new Set(
      this.allRosters()
        .filter((item) => item.rosterStatus === 'ACTIVE' && this.isRosterValidForMatchDate(item))
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
  protected readonly selectedRosterReadinessMessage = computed(() => {
    const status = this.form.controls.status.getRawValue();
    if (status === 'CANCELLED') {
      return '';
    }

    const homeId = this.selectedHomeTournamentTeamId();
    const awayId = this.selectedAwayTournamentTeamId();
    if (!homeId || !awayId) {
      return '';
    }

    const scheduledDate = this.selectedMatchDate();
    const readiness = [this.teamRosterReadiness(homeId, scheduledDate), this.teamRosterReadiness(awayId, scheduledDate)];
    const blocked = readiness.filter((item) => !item.hasRosterForMatchDate);
    if (blocked.length === 0) {
      return '';
    }

    const dateLabel = scheduledDate ? ` para el ${this.formatRosterDate(scheduledDate)}` : '';
    const details = blocked
      .map((item) => {
        if (item.activeCount === 0) {
          return `${item.label}: no tiene jugadores activos en plantel`;
        }
        if (!scheduledDate) {
          return `${item.label}: tiene jugadores activos, pero falta fecha del partido para validar vigencia`;
        }
        if (item.expiredCount > 0 && item.futureCount === 0) {
          return `${item.label}: sus jugadores activos vencieron antes de la fecha del partido`;
        }
        if (item.futureCount > 0 && item.expiredCount === 0) {
          return `${item.label}: sus jugadores activos empiezan despues de la fecha del partido`;
        }
        return `${item.label}: tiene jugadores activos, pero ninguno vigente en la fecha del partido`;
      })
      .join('. ');

    return `Antes de guardar, ambos equipos necesitan al menos un jugador con estado Activo y vigencia valida${dateLabel}. ${details}.`;
  });
  protected readonly readinessWarning = computed(() => {
    const tournamentId = this.selectedTournamentId();
    const approvedCount = this.tournamentTeams().filter((item) => item.registrationStatus === 'APPROVED').length;
    const rosterReadyCount = this.rosterReadyTournamentTeamIds().size;

    if (!tournamentId) {
      return '';
    }

    if (approvedCount === 0) {
      return 'Este campeonato aun no tiene inscripciones aprobadas. Completa ese paso antes de programar competencia.';
    }

    if (rosterReadyCount < 2) {
      return `Solo ${rosterReadyCount} inscripciones aprobadas tienen plantel activo y vigente para la fecha del partido. Se recomienda no avanzar hasta llegar al menos a 2.`;
    }

    return '';
  });

  protected readonly form = this.fb.nonNullable.group(
    {
      tournamentId: [0],
      stageId: ['' as number | ''],
      groupId: ['' as number | ''],
      roundNumber: ['', [Validators.min(1)]],
      matchdayNumber: ['', [Validators.min(1)]],
      homeTournamentTeamId: [0, [positiveSelectionValidator('homeTournamentTeamId')]],
      awayTournamentTeamId: [0, [positiveSelectionValidator('awayTournamentTeamId')]],
      homeTeamTournamentId: [0],
      awayTeamTournamentId: [0],
      scheduledDate: [null as Date | null],
      scheduledTime: [''],
      venueName: ['', [Validators.maxLength(150)]],
      status: ['SCHEDULED' as MatchStatus, Validators.required],
      homeScore: ['', [Validators.min(0)]],
      awayScore: ['', [Validators.min(0)]],
      winnerTournamentTeamId: ['' as number | ''],
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
      next: (items) => {
        this.allStages.set(items);
        this.applyDefaultStageAndGroupForTournament();
      }
    });
    this.catalogLoader.loadAll((page, size) => this.groupsService.list({ page, size })).subscribe({
      next: (items) => {
        this.allGroups.set(items);
        this.applyDefaultStageAndGroupForTournament();
      }
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
      const currentGroupId = Number(this.form.controls.groupId.getRawValue());
      const validTeamIds = new Set(
        this.allTournamentTeams().filter((item) => item.tournamentId === tournamentId).map((item) => item.id)
      );
      const currentStageId = Number(this.form.controls.stageId.getRawValue());
      const currentHomeTeamId = Number(this.form.controls.homeTournamentTeamId.getRawValue());
      const currentAwayTeamId = Number(this.form.controls.awayTournamentTeamId.getRawValue());
      const currentWinnerTeamId = Number(this.form.controls.winnerTournamentTeamId.getRawValue());

      this.form.patchValue(
        {
          stageId: currentStageId && validStageIds.has(currentStageId) ? currentStageId : '',
          groupId: currentStageId && validStageIds.has(currentStageId) ? currentGroupId || '' : '',
          homeTournamentTeamId: validTeamIds.has(currentHomeTeamId) ? currentHomeTeamId : 0,
          awayTournamentTeamId: validTeamIds.has(currentAwayTeamId) ? currentAwayTeamId : 0,
          winnerTournamentTeamId: validTeamIds.has(currentWinnerTeamId) ? currentWinnerTeamId : ''
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

      if (currentGroupId && validGroupIds.size > 0 && !validGroupIds.has(currentGroupId)) {
        this.form.patchValue({ groupId: '' }, { emitEvent: false });
      }

      this.applyDefaultStageAndGroupForTournament();
    });

    this.form.controls.homeTournamentTeamId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncSelectedTeamTournamentIds();
      this.syncWinnerSelection();
    });

    this.form.controls.awayTournamentTeamId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncSelectedTeamTournamentIds();
      this.syncWinnerSelection();
    });

    this.form.controls.homeScore.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncWinnerSelection();
    });

    this.form.controls.awayScore.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncWinnerSelection();
    });

    this.form.controls.scheduledDate.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.selectedScheduledDate.set(toBackendDate(value));
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
          this.form.patchValue(
            {
              tournamentId: match.tournamentId,
              stageId: match.stageId ?? '',
              groupId: match.groupId ?? '',
              roundNumber: match.roundNumber ? String(match.roundNumber) : '',
              matchdayNumber: match.matchdayNumber ? String(match.matchdayNumber) : '',
              homeTournamentTeamId: match.homeTournamentTeamId,
              awayTournamentTeamId: match.awayTournamentTeamId,
              scheduledDate: parseBackendDate(match.scheduledAt),
              scheduledTime: toTimeInputValue(match.scheduledAt),
              venueName: match.venueName ?? '',
              status: match.status,
              homeScore: match.homeScore !== null ? String(match.homeScore) : '',
              awayScore: match.awayScore !== null ? String(match.awayScore) : '',
              winnerTournamentTeamId: match.winnerTournamentTeamId ?? '',
              notes: match.notes ?? ''
            },
            { emitEvent: false }
          );
          this.selectedTournamentId.set(match.tournamentId);
          this.selectedStageId.set(match.stageId ?? 0);
          this.selectedScheduledDate.set(toBackendDate(parseBackendDate(match.scheduledAt)));
          this.syncSelectedTeamTournamentIds();
          this.syncWinnerSelection();
          this.applyDefaultStageAndGroupForTournament();
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
        'El campeonato no tiene suficientes planteles activos y vigentes para avanzar a competencia. Revisa estado, fecha inicio y fecha fin en Planteles.'
      );
      return;
    }

    if ((status === 'SCHEDULED' || status === 'PLAYED' || status === 'FORFEIT') && !this.selectedTeamsRosterReady()) {
      this.notifications.error(
        'Los equipos seleccionados deben tener plantel activo y vigente para la fecha del partido. Revisa las inscripciones elegidas en Planteles.'
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
      scheduledAt: toIsoFromDateAndTime(value.scheduledDate, value.scheduledTime),
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
        const tournamentId = Number(this.form.controls.tournamentId.getRawValue());
        void this.router.navigate(['/matches'], {
          queryParams: tournamentId ? { tournamentId } : {}
        });
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }

  protected tournamentTeamLabel(item: TournamentTeam): string {
    const team = this.teams().find((entry) => entry.id === item.teamId);
    const tournament = this.tournaments().find((entry) => entry.id === item.tournamentId);
    const teamLabel = team?.name ?? `Equipo ${item.teamId}`;
    const tournamentLabel = tournament?.name ?? `Campeonato ${item.tournamentId}`;
    return `${teamLabel} / ${tournamentLabel} (#${item.id})`;
  }

  protected tournamentName(id: number): string {
    if (!id) {
      return '';
    }

    return this.tournaments().find((item) => item.id === id)?.name ?? `Campeonato ${id}`;
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
      FORFEIT: 'Resultado por ausencia',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  protected readonly tournamentOptionLabel = (item: Tournament): string => item.name;

  protected readonly stageOptionLabel = (item: TournamentStage): string => item.name;

  protected readonly groupOptionLabel = (item: StageGroup): string => item.name;

  protected readonly tournamentTeamOptionLabel = (item: TournamentTeam): string => this.tournamentTeamLabel(item);

  private selectedMatchDate(): string | null {
    return this.selectedScheduledDate();
  }

  private isRosterValidForMatchDate(roster: RosterEntry): boolean {
    if (roster.rosterStatus !== 'ACTIVE') {
      return false;
    }

    const matchDate = this.selectedMatchDate();
    if (!matchDate) {
      return true;
    }

    return roster.startDate <= matchDate && (!roster.endDate || roster.endDate >= matchDate);
  }

  private teamRosterReadiness(tournamentTeamId: number, matchDate: string | null): TeamRosterReadiness {
    const activeRosters = this.allRosters().filter(
      (item) => item.tournamentTeamId === tournamentTeamId && item.rosterStatus === 'ACTIVE'
    );
    const validCount = matchDate
      ? activeRosters.filter((item) => item.startDate <= matchDate && (!item.endDate || item.endDate >= matchDate)).length
      : activeRosters.length;
    const expiredCount = matchDate ? activeRosters.filter((item) => item.endDate && item.endDate < matchDate).length : 0;
    const futureCount = matchDate ? activeRosters.filter((item) => item.startDate > matchDate).length : 0;

    return {
      label: this.tournamentTeamName(tournamentTeamId),
      activeCount: activeRosters.length,
      validCount,
      futureCount,
      expiredCount,
      hasRosterForMatchDate: validCount > 0
    };
  }

  private tournamentTeamName(id: number): string {
    const item = this.allTournamentTeams().find((entry) => entry.id === id);
    return item ? this.tournamentTeamLabel(item) : `Inscripcion ${id}`;
  }

  private formatRosterDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
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

  private applyDefaultStageAndGroupForTournament(): void {
    const tournamentId = this.selectedTournamentId();
    if (!tournamentId) {
      return;
    }

    let stageId = Number(this.form.controls.stageId.getRawValue());
    if (!stageId) {
      const tournamentStages = this.allStages().filter((item) => item.tournamentId === tournamentId);
      if (tournamentStages.length === 1) {
        stageId = tournamentStages[0].id;
        this.selectedStageId.set(stageId);
        this.form.patchValue({ stageId }, { emitEvent: false });
      }
    }

    const groupId = Number(this.form.controls.groupId.getRawValue());
    if (!groupId && stageId) {
      const stageGroups = this.allGroups().filter((item) => item.stageId === stageId);
      if (stageGroups.length === 1) {
        this.form.patchValue({ groupId: stageGroups[0].id }, { emitEvent: false });
      }
    }
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
    const homeScoreValue = this.form.controls.homeScore.getRawValue();
    const awayScoreValue = this.form.controls.awayScore.getRawValue();
    const hasHomeScore = homeScoreValue !== '' && homeScoreValue !== null;
    const hasAwayScore = awayScoreValue !== '' && awayScoreValue !== null;

    if (hasHomeScore && hasAwayScore && Number(homeScoreValue) === Number(awayScoreValue)) {
      if (winnerId) {
        this.form.patchValue({ winnerTournamentTeamId: '' }, { emitEvent: false });
      }
      return;
    }

    if (winnerId && winnerId !== homeId && winnerId !== awayId) {
      this.form.patchValue({ winnerTournamentTeamId: '' }, { emitEvent: false });
    }
  }
}
