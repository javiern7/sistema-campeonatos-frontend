import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { TournamentTeamFormValue, TournamentTeamRegistrationStatus } from './tournament-team.models';
import { TournamentTeamsService } from './tournament-teams.service';

@Component({
  selector: 'app-tournament-team-form-page',
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
        [title]="isEditMode() ? 'Editar inscripcion' : 'Nueva inscripcion'"
        [subtitle]="pageSubtitle()"
      />

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

                <mat-form-field appearance="outline">
                  <mat-label>Equipo</mat-label>
                  <mat-select formControlName="teamId">
                    @for (item of teams(); track item.id) {
                      <mat-option [value]="item.id">{{ item.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }

              <mat-form-field appearance="outline">
                <mat-label>Estado</mat-label>
                <mat-select formControlName="registrationStatus">
                  @for (status of statuses; track status) {
                    <mat-option [value]="status">{{ statusLabel(status) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Seed</mat-label>
                <input matInput type="number" formControlName="seedNumber">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Posicion de sorteo</mat-label>
                <input matInput type="number" formControlName="groupDrawPosition">
              </mat-form-field>
            </div>

            <div class="form-actions">
              <a mat-stroked-button routerLink="/tournament-teams">Cancelar</a>
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
export class TournamentTeamFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly teamsService = inject(TeamsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly registrationId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.registrationId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly statuses: TournamentTeamRegistrationStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
  protected readonly pageSubtitle = computed(() => {
    const tournament = this.tournaments().find((item) => item.id === Number(this.form.controls.tournamentId.getRawValue()));
    const team = this.teams().find((item) => item.id === Number(this.form.controls.teamId.getRawValue()));
    const labels = [tournament?.name, team?.name].filter((item) => Boolean(item));

    return labels.length > 0 ? labels.join(' / ') : 'Vincula un equipo con un torneo y define su estado operativo.';
  });

  protected readonly form = this.fb.nonNullable.group({
    tournamentId: [0],
    teamId: [0],
    registrationStatus: ['PENDING' as TournamentTeamRegistrationStatus, Validators.required],
    seedNumber: [''],
    groupDrawPosition: ['']
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

    this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })).subscribe({
      next: (items) => {
        this.teams.set(items);
        if (!this.isEditMode() && items.length > 0) {
          this.form.patchValue({ teamId: items[0].id });
        }
      }
    });

    if (!this.isEditMode()) {
      this.pageLoading.set(false);
      return;
    }

    this.tournamentTeamsService
      .getById(this.registrationId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (item) =>
          this.form.patchValue({
            tournamentId: item.tournamentId,
            teamId: item.teamId,
            registrationStatus: item.registrationStatus,
            seedNumber: item.seedNumber ? String(item.seedNumber) : '',
            groupDrawPosition: item.groupDrawPosition ? String(item.groupDrawPosition) : ''
          }),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: TournamentTeamFormValue = {
      tournamentId: Number(value.tournamentId),
      teamId: Number(value.teamId),
      registrationStatus: value.registrationStatus,
      seedNumber: value.seedNumber ? Number(value.seedNumber) : null,
      groupDrawPosition: value.groupDrawPosition ? Number(value.groupDrawPosition) : null
    };

    this.saving.set(true);
    const request$ = this.isEditMode()
      ? this.tournamentTeamsService.update(this.registrationId, {
          registrationStatus: payload.registrationStatus,
          seedNumber: payload.seedNumber,
          groupDrawPosition: payload.groupDrawPosition
        })
      : this.tournamentTeamsService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Inscripcion guardada correctamente');
        void this.router.navigateByUrl('/tournament-teams');
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }

  protected statusLabel(status: TournamentTeamRegistrationStatus): string {
    const labels: Record<TournamentTeamRegistrationStatus, string> = {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      WITHDRAWN: 'Retirada'
    };

    return labels[status];
  }
}
