import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { TournamentStage } from '../tournament-stages/tournament-stage.models';
import { TournamentStagesService } from '../tournament-stages/tournament-stages.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { MatchFormValue, MatchStatus } from './match.models';
import { MatchesService } from './matches.service';

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
      <app-page-header [title]="isEditMode() ? 'Editar partido' : 'Nuevo partido'" subtitle="Programacion y resultado basico." />

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
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Equipo visita</mat-label>
                <mat-select formControlName="awayTournamentTeamId">
                  @for (item of tournamentTeams(); track item.id) {
                    <mat-option [value]="item.id">{{ tournamentTeamLabel(item) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  @for (status of statuses; track status) {
                    <mat-option [value]="status">{{ status }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Round</mat-label>
                <input matInput type="number" formControlName="roundNumber">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Matchday</mat-label>
                <input matInput type="number" formControlName="matchdayNumber">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha y hora</mat-label>
                <input matInput type="datetime-local" formControlName="scheduledAt">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Sede</mat-label>
                <input matInput formControlName="venueName">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Score local</mat-label>
                <input matInput type="number" formControlName="homeScore">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Score visita</mat-label>
                <input matInput type="number" formControlName="awayScore">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Ganador</mat-label>
                <mat-select formControlName="winnerTournamentTeamId">
                  <mat-option value="">Sin definir</mat-option>
                  @for (item of tournamentTeams(); track item.id) {
                    <mat-option [value]="item.id">{{ tournamentTeamLabel(item) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Notas</mat-label>
                <textarea matInput rows="3" formControlName="notes"></textarea>
              </mat-form-field>
            </div>

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
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly matchesService = inject(MatchesService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly matchId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.matchId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly tournaments = signal<Tournament[]>([]);
  private readonly allStages = signal<TournamentStage[]>([]);
  private readonly allGroups = signal<StageGroup[]>([]);
  private readonly allTournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly statuses: MatchStatus[] = ['SCHEDULED', 'PLAYED', 'FORFEIT', 'CANCELLED'];
  protected readonly stages = computed(() => {
    const tournamentId = Number(this.form.controls.tournamentId.getRawValue());
    return tournamentId ? this.allStages().filter((item) => item.tournamentId === tournamentId) : this.allStages();
  });
  protected readonly groups = computed(() => {
    const stageId = Number(this.form.controls.stageId.getRawValue());
    return stageId ? this.allGroups().filter((item) => item.stageId === stageId) : [];
  });
  protected readonly tournamentTeams = computed(() => {
    const tournamentId = Number(this.form.controls.tournamentId.getRawValue());
    return tournamentId
      ? this.allTournamentTeams().filter((item) => item.tournamentId === tournamentId)
      : this.allTournamentTeams();
  });

  protected readonly form = this.fb.nonNullable.group({
    tournamentId: [0],
    stageId: [''],
    groupId: [''],
    roundNumber: [''],
    matchdayNumber: [''],
    homeTournamentTeamId: [0, Validators.required],
    awayTournamentTeamId: [0, Validators.required],
    scheduledAt: [''],
    venueName: [''],
    status: ['SCHEDULED' as MatchStatus, Validators.required],
    homeScore: [''],
    awayScore: [''],
    winnerTournamentTeamId: [''],
    notes: ['']
  });

  constructor() {
    this.catalogLoader.loadAll((page, size) => this.tournamentsService.list({ page, size })).subscribe({
      next: (items) => {
        this.tournaments.set(items);
        if (!this.isEditMode() && items.length > 0) {
          this.form.patchValue({ tournamentId: items[0].id });
        }
      }
    });

    this.catalogLoader.loadAll((page, size) => this.stagesService.list({ page, size })).subscribe({
      next: (items) => this.allStages.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.groupsService.list({ page, size })).subscribe({
      next: (items) => this.allGroups.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ page, size })).subscribe({
      next: (items) => {
        this.allTournamentTeams.set(items);
        if (!this.isEditMode() && items.length > 1) {
          this.form.patchValue({
            homeTournamentTeamId: items[0].id,
            awayTournamentTeamId: items[1].id
          });
        }
      }
    });

    this.form.controls.tournamentId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const tournamentId = Number(value);
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
    });

    this.form.controls.stageId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const stageId = Number(value);
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

    this.matchesService
      .getById(this.matchId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (match) =>
          this.form.patchValue({
            tournamentId: match.tournamentId,
            stageId: match.stageId ? String(match.stageId) : '',
            groupId: match.groupId ? String(match.groupId) : '',
            roundNumber: match.roundNumber ? String(match.roundNumber) : '',
            matchdayNumber: match.matchdayNumber ? String(match.matchdayNumber) : '',
            homeTournamentTeamId: match.homeTournamentTeamId,
            awayTournamentTeamId: match.awayTournamentTeamId,
            scheduledAt: match.scheduledAt ? match.scheduledAt.slice(0, 16) : '',
            venueName: match.venueName ?? '',
            status: match.status,
            homeScore: match.homeScore !== null ? String(match.homeScore) : '',
            awayScore: match.awayScore !== null ? String(match.awayScore) : '',
            winnerTournamentTeamId: match.winnerTournamentTeamId ? String(match.winnerTournamentTeamId) : '',
            notes: match.notes ?? ''
          }),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: MatchFormValue = {
      tournamentId: Number(value.tournamentId),
      stageId: value.stageId ? Number(value.stageId) : null,
      groupId: value.groupId ? Number(value.groupId) : null,
      roundNumber: value.roundNumber ? Number(value.roundNumber) : null,
      matchdayNumber: value.matchdayNumber ? Number(value.matchdayNumber) : null,
      homeTournamentTeamId: Number(value.homeTournamentTeamId),
      awayTournamentTeamId: Number(value.awayTournamentTeamId),
      scheduledAt: value.scheduledAt ? new Date(value.scheduledAt).toISOString() : null,
      venueName: value.venueName || null,
      status: value.status,
      homeScore: value.homeScore ? Number(value.homeScore) : null,
      awayScore: value.awayScore ? Number(value.awayScore) : null,
      winnerTournamentTeamId: value.winnerTournamentTeamId ? Number(value.winnerTournamentTeamId) : null,
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
    return `#${item.id} - Equipo ${item.teamId}`;
  }
}
