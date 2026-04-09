import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { MatchGame } from '../matches/match.models';
import { MatchesService } from '../matches/matches.service';
import { Player } from '../players/player.models';
import { PlayersService } from '../players/players.service';
import { RosterEntry } from '../rosters/roster.models';
import { RostersService } from '../rosters/rosters.service';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import {
  DisciplineMatchResponse,
  DisciplinaryIncident,
  DisciplinaryIncidentType,
  DisciplinarySanction,
  DisciplinarySanctionType
} from './discipline.models';
import { DisciplineService } from './discipline.service';

type RosterOption = {
  playerId: number;
  label: string;
};

@Component({
  selector: 'app-discipline-match-page',
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
      <app-page-header title="Disciplina del partido" [subtitle]="headerSubtitle()">
        <div class="header-actions">
          <a mat-stroked-button routerLink="/matches">Volver a partidos</a>
          @if (match()) {
            <a mat-stroked-button [routerLink]="['/matches', match()!.id, 'edit']">Editar partido</a>
            <a mat-stroked-button [routerLink]="['/tournaments', match()!.tournamentId, 'discipline']">Sanciones del torneo</a>
          }
        </div>
      </app-page-header>

      @if (loading()) {
        <app-loading-state label="Cargando registro disciplinario..." />
      } @else if (!match()) {
        <section class="card page-card app-page">
          <div class="empty-state">
            <strong>No se encontro el partido solicitado.</strong>
            <p class="muted">Abre el registro disciplinario desde el listado de partidos para conservar el contexto oficial.</p>
          </div>
        </section>
      } @else {
        <section class="card page-card app-page">
          <div class="context-banner">
            <strong>{{ fixtureLabel() }}</strong>
            <span class="muted">Registro acotado por partido, separado de notas, roster y resultados.</span>
          </div>

          <div class="summary-grid">
            <article class="summary-card card accent">
              <span class="summary-label">Incidencias</span>
              <span class="summary-value">{{ discipline()?.incidents?.length ?? 0 }}</span>
              <span class="summary-meta">Eventos trazables del partido</span>
            </article>
            <article class="summary-card card">
              <span class="summary-label">Sanciones</span>
              <span class="summary-value">{{ discipline()?.sanctions?.length ?? 0 }}</span>
              <span class="summary-meta">{{ activeSanctionsCount() }} activas</span>
            </article>
            <article class="summary-card card">
              <span class="summary-label">Validacion roster</span>
              <span class="summary-value">{{ traceabilityValue('rosterValidationMode') }}</span>
              <span class="summary-meta">Validacion declarada</span>
            </article>
          </div>
        </section>

        @if (canManage()) {
          <section class="content-grid">
            <section class="card page-card app-page">
              <div class="section-heading">
                <div>
                  <h2>Registrar incidencia</h2>
                  <p class="muted">Una incidencia pertenece a un jugador del roster de uno de los equipos del partido.</p>
                </div>
              </div>

              <form [formGroup]="incidentForm" (ngSubmit)="createIncident()" class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Equipo</mat-label>
                  <mat-select formControlName="tournamentTeamId">
                    @for (team of matchTournamentTeams(); track team.id) {
                      <mat-option [value]="team.id">{{ tournamentTeamLabel(team.id) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Jugador</mat-label>
                  <mat-select formControlName="playerId">
                    @for (option of rosterOptions(); track option.playerId) {
                      <mat-option [value]="option.playerId">{{ option.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Tipo</mat-label>
                  <mat-select formControlName="incidentType">
                    @for (type of incidentTypes; track type) {
                      <mat-option [value]="type">{{ incidentTypeLabel(type) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Minuto</mat-label>
                  <input matInput type="number" formControlName="incidentMinute">
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-row">
                  <mat-label>Notas</mat-label>
                  <textarea matInput rows="2" formControlName="notes"></textarea>
                </mat-form-field>
                <div class="form-actions full-row">
                  <button mat-flat-button color="primary" type="submit" [disabled]="incidentForm.invalid || savingIncident()">
                    {{ savingIncident() ? 'Registrando...' : 'Registrar incidencia' }}
                  </button>
                </div>
              </form>
            </section>

            <section class="card page-card app-page">
              <div class="section-heading">
                <div>
                  <h2>Registrar sancion</h2>
                  <p class="muted">La sancion siempre nace de una incidencia existente del mismo partido.</p>
                </div>
              </div>

              <form [formGroup]="sanctionForm" (ngSubmit)="createSanction()" class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Incidencia origen</mat-label>
                  <mat-select formControlName="incidentId">
                    @for (incident of discipline()?.incidents ?? []; track incident.incidentId) {
                      <mat-option [value]="incident.incidentId">{{ incidentOptionLabel(incident) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Tipo</mat-label>
                  <mat-select formControlName="sanctionType">
                    @for (type of sanctionTypes; track type) {
                      <mat-option [value]="type">{{ sanctionTypeLabel(type) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Partidos</mat-label>
                  <input matInput type="number" formControlName="matchesToServe">
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-row">
                  <mat-label>Notas</mat-label>
                  <textarea matInput rows="2" formControlName="notes"></textarea>
                </mat-form-field>
                <div class="form-actions full-row">
                  <button mat-flat-button color="primary" type="submit" [disabled]="sanctionForm.invalid || savingSanction()">
                    {{ savingSanction() ? 'Registrando...' : 'Registrar sancion' }}
                  </button>
                </div>
              </form>
            </section>
          </section>
        }

        <section class="content-grid">
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Incidencias</h2>
                <p class="muted">Eventos simples registrados para este partido.</p>
              </div>
            </div>

            @if ((discipline()?.incidents?.length ?? 0) === 0) {
              <div class="empty-state">
                <strong>Sin incidencias registradas.</strong>
                <p class="muted">El partido aun no tiene registro disciplinario visible.</p>
              </div>
            } @else {
              <div class="list-stack">
                @for (incident of discipline()!.incidents; track incident.incidentId) {
                  <article class="list-card">
                    <div class="section-heading compact">
                      <strong>{{ incidentTypeLabel(incident.incidentType) }}</strong>
                      <span class="muted">{{ minuteLabel(incident.incidentMinute) }}</span>
                    </div>
                    <span>{{ incidentPlayerName(incident) }}</span>
                    <span class="muted">{{ incidentTeamLabel(incident) }} · {{ formatDate(incident.createdAt) }}</span>
                    @if (incident.notes) {
                      <span class="muted">{{ incident.notes }}</span>
                    }
                  </article>
                }
              </div>
            }
          </section>

          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Sanciones</h2>
                <p class="muted">Lectura simple y trazable, sin acumulaciones ni apelaciones.</p>
              </div>
            </div>

            @if ((discipline()?.sanctions?.length ?? 0) === 0) {
              <div class="empty-state">
                <strong>Sin sanciones visibles.</strong>
                <p class="muted">Las amonestaciones pueden existir sin sancion adicional.</p>
              </div>
            } @else {
              <div class="list-stack">
                @for (sanction of discipline()!.sanctions; track sanction.sanctionId) {
                  <article class="list-card">
                    <div class="section-heading compact">
                      <strong>{{ sanctionTypeLabel(sanction.sanctionType) }}</strong>
                      <span [class]="sanctionStatusClass(sanction.status)">{{ sanctionStatusLabel(sanction.status) }}</span>
                    </div>
                    <span>{{ sanctionPlayerName(sanction) }}</span>
                    <span class="muted">{{ sanctionTeamLabel(sanction) }} · {{ sanction.remainingMatches }} pendiente(s)</span>
                    <span class="muted">Incidencia #{{ sanction.incidentId }} · {{ formatDate(sanction.createdAt) }}</span>
                  </article>
                }
              </div>
            }
          </section>
        </section>
      }
    </section>
  `,
  styles: [
    `
      .header-actions,
      .section-heading {
        display: flex;
        gap: 0.75rem;
        align-items: start;
        justify-content: space-between;
      }

      .header-actions {
        flex-wrap: wrap;
      }

      .content-grid,
      .list-stack {
        display: grid;
        gap: 1rem;
      }

      .content-grid {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }

      .section-heading h2,
      .section-heading p {
        margin: 0;
      }

      .compact {
        align-items: center;
      }

      .list-card {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .full-row {
        grid-column: 1 / -1;
      }

      @media (max-width: 720px) {
        .section-heading {
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DisciplineMatchPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly disciplineService = inject(DisciplineService);
  private readonly matchesService = inject(MatchesService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly rostersService = inject(RostersService);
  private readonly playersService = inject(PlayersService);
  private readonly teamsService = inject(TeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly matchId = signal(Number(this.route.snapshot.paramMap.get('id') ?? 0));
  protected readonly loading = signal(true);
  protected readonly savingIncident = signal(false);
  protected readonly savingSanction = signal(false);
  protected readonly match = signal<MatchGame | null>(null);
  protected readonly discipline = signal<DisciplineMatchResponse | null>(null);
  private readonly tournamentTeams = signal<TournamentTeam[]>([]);
  private readonly rosters = signal<RosterEntry[]>([]);
  private readonly players = signal<Player[]>([]);
  private readonly teams = signal<Team[]>([]);
  private readonly selectedIncidentTournamentTeamId = signal(0);
  protected readonly incidentTypes: DisciplinaryIncidentType[] = ['AMONESTACION', 'EXPULSION', 'INFORME_DISCIPLINARIO_SIMPLE'];
  protected readonly sanctionTypes: DisciplinarySanctionType[] = ['ANOTACION_DISCIPLINARIA', 'SUSPENSION_PROXIMO_PARTIDO'];
  protected readonly canManage = computed(() => this.authorization.canManage('matches'));
  protected readonly headerSubtitle = computed(() => {
    const match = this.match();
    return match ? `${this.fixtureLabel()} · ${this.matchStatusLabel(match.status)}` : 'Registro disciplinario basico por partido.';
  });
  protected readonly matchTournamentTeams = computed(() => {
    const match = this.match();
    if (!match) {
      return [];
    }

    const ids = new Set([match.homeTournamentTeamId, match.awayTournamentTeamId]);
    return this.tournamentTeams().filter((item) => ids.has(item.id));
  });
  protected readonly rosterOptions = computed<RosterOption[]>(() => {
    const selectedTournamentTeamId = this.selectedIncidentTournamentTeamId();
    return this.rosters()
      .filter((item) => item.tournamentTeamId === selectedTournamentTeamId && item.rosterStatus === 'ACTIVE')
      .map((item) => ({ playerId: item.playerId, label: this.playerName(item.playerId) }));
  });
  protected readonly activeSanctionsCount = computed(
    () => this.discipline()?.sanctions.filter((item) => item.status === 'ACTIVE').length ?? 0
  );
  protected readonly incidentForm = this.fb.nonNullable.group({
    tournamentTeamId: [0, [Validators.min(1)]],
    playerId: [0, [Validators.min(1)]],
    incidentType: ['AMONESTACION' as DisciplinaryIncidentType, Validators.required],
    incidentMinute: ['', [Validators.min(0)]],
    notes: ['']
  });
  protected readonly sanctionForm = this.fb.nonNullable.group({
    incidentId: [0, [Validators.min(1)]],
    sanctionType: ['ANOTACION_DISCIPLINARIA' as DisciplinarySanctionType, Validators.required],
    matchesToServe: [0, [Validators.min(0)]],
    notes: ['']
  });

  constructor() {
    this.incidentForm.controls.tournamentTeamId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const tournamentTeamId = Number(value);
      this.selectedIncidentTournamentTeamId.set(tournamentTeamId);
      const playerId = this.rosters().find((item) => item.tournamentTeamId === tournamentTeamId && item.rosterStatus === 'ACTIVE')?.playerId ?? 0;
      this.incidentForm.patchValue({ playerId }, { emitEvent: false });
    });
    this.load();
  }

  protected load(): void {
    const matchId = this.matchId();
    if (!matchId) {
      this.loading.set(false);
      this.match.set(null);
      return;
    }

    this.loading.set(true);
    forkJoin({
      match: this.matchesService.getById(matchId),
      discipline: this.disciplineService.getMatchDiscipline(matchId),
      tournamentTeams: this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ page, size })),
      rosters: this.catalogLoader.loadAll((page, size) => this.rostersService.list({ page, size })),
      players: this.catalogLoader.loadAll((page, size) => this.playersService.list({ page, size })),
      teams: this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size }))
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const teamIds = new Set([result.match.homeTournamentTeamId, result.match.awayTournamentTeamId]);
          this.match.set(result.match);
          this.discipline.set(result.discipline);
          this.tournamentTeams.set(result.tournamentTeams.filter((item) => item.tournamentId === result.match.tournamentId));
          this.rosters.set(result.rosters.filter((item) => teamIds.has(item.tournamentTeamId)));
          this.players.set(result.players);
          this.teams.set(result.teams);
          this.applyDefaultFormValues();
        },
        error: (error: unknown) => {
          this.match.set(null);
          this.discipline.set(null);
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }

  protected createIncident(): void {
    this.incidentForm.markAllAsTouched();
    if (this.incidentForm.invalid || this.savingIncident()) {
      return;
    }

    const value = this.incidentForm.getRawValue();
    this.savingIncident.set(true);
    this.disciplineService
      .createIncident(this.matchId(), {
        tournamentTeamId: Number(value.tournamentTeamId),
        playerId: Number(value.playerId),
        incidentType: value.incidentType,
        incidentMinute: value.incidentMinute === '' ? null : Number(value.incidentMinute),
        notes: value.notes || null
      })
      .pipe(finalize(() => this.savingIncident.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Incidencia disciplinaria registrada');
          this.incidentForm.patchValue({ incidentMinute: '', notes: '' });
          this.reloadDiscipline();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected createSanction(): void {
    this.sanctionForm.markAllAsTouched();
    if (this.sanctionForm.invalid || this.savingSanction()) {
      return;
    }

    const value = this.sanctionForm.getRawValue();
    this.savingSanction.set(true);
    this.disciplineService
      .createSanction(this.matchId(), Number(value.incidentId), {
        sanctionType: value.sanctionType,
        matchesToServe: Number(value.matchesToServe),
        notes: value.notes || null
      })
      .pipe(finalize(() => this.savingSanction.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Sancion disciplinaria registrada');
          this.sanctionForm.patchValue({ matchesToServe: 0, notes: '' });
          this.reloadDiscipline();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected fixtureLabel(): string {
    const match = this.match();
    if (!match) {
      return 'Partido sin contexto';
    }

    return `${this.tournamentTeamLabel(match.homeTournamentTeamId)} vs ${this.tournamentTeamLabel(match.awayTournamentTeamId)}`;
  }

  protected tournamentTeamLabel(tournamentTeamId: number): string {
    const registration = this.tournamentTeams().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `Inscripcion #${tournamentTeamId}`;
    }

    const team = this.teams().find((item) => item.id === registration.teamId);
    return team ? `${team.name} (#${registration.id})` : `Equipo ${registration.teamId} (#${registration.id})`;
  }

  protected playerName(playerId: number): string {
    const player = this.players().find((item) => item.id === playerId);
    return player ? `${player.firstName} ${player.lastName}` : `Jugador ${playerId}`;
  }

  protected incidentOptionLabel(incident: DisciplinaryIncident): string {
    return `#${incident.incidentId} · ${this.incidentTypeLabel(incident.incidentType)} · ${this.incidentPlayerName(incident)}`;
  }

  protected incidentPlayerName(incident: DisciplinaryIncident): string {
    return incident.player?.fullName ?? incident.playerName ?? this.playerName(this.incidentPlayerId(incident));
  }

  protected sanctionPlayerName(sanction: DisciplinarySanction): string {
    return sanction.player?.fullName ?? sanction.playerName ?? this.playerName(this.sanctionPlayerId(sanction));
  }

  protected incidentTeamLabel(incident: DisciplinaryIncident): string {
    return this.tournamentTeamLabel(this.incidentTournamentTeamId(incident));
  }

  protected sanctionTeamLabel(sanction: DisciplinarySanction): string {
    return this.tournamentTeamLabel(this.sanctionTournamentTeamId(sanction));
  }

  protected incidentTypeLabel(type: DisciplinaryIncident['incidentType']): string {
    const labels: Record<string, string> = {
      AMONESTACION: 'Amonestacion',
      EXPULSION: 'Expulsion',
      INFORME_DISCIPLINARIO_SIMPLE: 'Informe simple'
    };

    return labels[type] ?? type;
  }

  protected sanctionTypeLabel(type: DisciplinarySanction['sanctionType']): string {
    const labels: Record<string, string> = {
      ANOTACION_DISCIPLINARIA: 'Anotacion disciplinaria',
      SUSPENSION_PROXIMO_PARTIDO: 'Suspension proximo partido'
    };

    return labels[type] ?? type;
  }

  protected sanctionStatusLabel(status: DisciplinarySanction['status']): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Activa',
      SERVED: 'Cumplida',
      CANCELLED: 'Cancelada'
    };

    return labels[status] ?? status;
  }

  protected sanctionStatusClass(status: DisciplinarySanction['status']): string {
    const statusClassMap: Record<string, string> = {
      ACTIVE: 'status-pill scheduled',
      SERVED: 'status-pill played',
      CANCELLED: 'status-pill cancelled'
    };

    return statusClassMap[status] ?? 'status-pill forfeit';
  }

  protected matchStatusLabel(status: MatchGame['status']): string {
    const labels: Record<MatchGame['status'], string> = {
      SCHEDULED: 'Programado',
      PLAYED: 'Jugado',
      FORFEIT: 'Forfeit',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  protected minuteLabel(minute: number | null): string {
    return minute === null ? 'Sin minuto' : `Min. ${minute}`;
  }

  protected traceabilityValue(key: keyof NonNullable<DisciplineMatchResponse['traceability']>): string {
    return this.discipline()?.traceability?.[key] ?? 'Backend';
  }

  protected formatDate(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    if (!parsed) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(parsed);
  }

  private reloadDiscipline(): void {
    this.disciplineService.getMatchDiscipline(this.matchId()).subscribe({
      next: (discipline) => {
        this.discipline.set(discipline);
        this.applyDefaultFormValues();
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }

  private applyDefaultFormValues(): void {
    const match = this.match();
    if (!match) {
      return;
    }

    const currentTeamId = Number(this.incidentForm.controls.tournamentTeamId.getRawValue());
    const teamId = currentTeamId || match.homeTournamentTeamId;
    const playerId = this.rosters().find((item) => item.tournamentTeamId === teamId && item.rosterStatus === 'ACTIVE')?.playerId ?? 0;
    const incidentId = this.discipline()?.incidents[0]?.incidentId ?? 0;
    this.selectedIncidentTournamentTeamId.set(teamId);
    this.incidentForm.patchValue({ tournamentTeamId: teamId, playerId }, { emitEvent: false });
    this.sanctionForm.patchValue({ incidentId }, { emitEvent: false });
  }

  private incidentPlayerId(incident: DisciplinaryIncident): number {
    return incident.player?.playerId ?? incident.playerId ?? 0;
  }

  private sanctionPlayerId(sanction: DisciplinarySanction): number {
    return sanction.player?.playerId ?? sanction.playerId ?? 0;
  }

  private incidentTournamentTeamId(incident: DisciplinaryIncident): number {
    return incident.team?.tournamentTeamId ?? incident.tournamentTeamId ?? 0;
  }

  private sanctionTournamentTeamId(sanction: DisciplinarySanction): number {
    return sanction.team?.tournamentTeamId ?? sanction.tournamentTeamId ?? 0;
  }
}
