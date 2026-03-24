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
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Player } from '../players/player.models';
import { PlayersService } from '../players/players.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { RosterFormValue, RosterStatus } from './roster.models';
import { RostersService } from './rosters.service';

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
            <div class="form-grid">
              @if (!isEditMode()) {
                <mat-form-field appearance="outline">
                  <mat-label>Inscripcion</mat-label>
                  <mat-select formControlName="tournamentTeamId">
                    @for (item of tournamentTeams(); track item.id) {
                      <mat-option [value]="item.id">{{ tournamentTeamLabel(item) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Jugador</mat-label>
                  <mat-select formControlName="playerId">
                    @for (item of players(); track item.id) {
                      <mat-option [value]="item.id">{{ item.firstName }} {{ item.lastName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }

              <mat-form-field appearance="outline">
                <mat-label>Numero camiseta</mat-label>
                <input matInput type="number" formControlName="jerseyNumber">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Posicion</mat-label>
                <input matInput formControlName="positionName">
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
              </mat-form-field>
            </div>

            <mat-checkbox formControlName="captain">Capitan</mat-checkbox>

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
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly rostersService = inject(RostersService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly rosterId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.rosterId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly players = signal<Player[]>([]);
  protected readonly tournamentTeams = signal<TournamentTeam[]>([]);
  protected readonly statuses: RosterStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

  protected readonly form = this.fb.nonNullable.group({
    tournamentTeamId: [0],
    playerId: [0],
    jerseyNumber: [''],
    captain: [false],
    positionName: [''],
    rosterStatus: ['ACTIVE' as RosterStatus, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['']
  });

  constructor() {
    this.catalogLoader.loadAll((page, size) => this.playersService.list({ page, size })).subscribe({
      next: (items) => {
        this.players.set(items);
        if (!this.isEditMode() && items.length > 0) {
          this.form.patchValue({ playerId: items[0].id });
        }
      }
    });

    this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ page, size })).subscribe({
      next: (items) => {
        this.tournamentTeams.set(items);
        if (!this.isEditMode() && items.length > 0) {
          this.form.patchValue({ tournamentTeamId: items[0].id });
        }
      }
    });

    if (!this.isEditMode()) {
      this.pageLoading.set(false);
      return;
    }

    this.rostersService
      .getById(this.rosterId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (entry) =>
          this.form.patchValue({
            tournamentTeamId: entry.tournamentTeamId,
            playerId: entry.playerId,
            jerseyNumber: entry.jerseyNumber ? String(entry.jerseyNumber) : '',
            captain: entry.captain,
            positionName: entry.positionName ?? '',
            rosterStatus: entry.rosterStatus,
            startDate: entry.startDate,
            endDate: entry.endDate ?? ''
          }),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: RosterFormValue = {
      tournamentTeamId: Number(value.tournamentTeamId),
      playerId: Number(value.playerId),
      jerseyNumber: value.jerseyNumber ? Number(value.jerseyNumber) : null,
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
    return `#${item.id} - Torneo ${item.tournamentId} - Equipo ${item.teamId}`;
  }
}
