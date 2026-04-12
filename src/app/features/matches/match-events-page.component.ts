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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Player } from '../players/player.models';
import { PlayersService } from '../players/players.service';
import { RosterEntry } from '../rosters/roster.models';
import { RostersService } from '../rosters/rosters.service';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { MatchEvent, MatchEventFormValue, MatchEventType, MatchGame } from './match.models';
import { MatchesService } from './matches.service';

const parseOptionalNumber = (value: string | number | null | undefined): number | null => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const eventRulesValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const eventType = control.get('eventType')?.value as MatchEventType;
  const tournamentTeamId = Number(control.get('tournamentTeamId')?.value);
  const playerId = Number(control.get('playerId')?.value);
  const relatedPlayerId = Number(control.get('relatedPlayerId')?.value);
  const minute = control.get('eventMinute')?.value;
  const value = control.get('eventValue')?.value;
  const needsTeamPlayerMinute = ['SCORE', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION'].includes(eventType);
  const hasMinute = minute !== '' && minute !== null && minute !== undefined;
  const hasValue = value !== '' && value !== null && value !== undefined;

  if (needsTeamPlayerMinute && (!tournamentTeamId || !playerId || !hasMinute)) {
    return { requiredEventContext: true };
  }

  if (eventType === 'SCORE' && (!hasValue || Number(value) <= 0)) {
    return { requiredScoreValue: true };
  }

  if (eventType === 'SUBSTITUTION' && (!relatedPlayerId || relatedPlayerId === playerId)) {
    return { invalidSubstitution: true };
  }

  return null;
};

@Component({
  selector: 'app-match-events-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Eventos del partido" [subtitle]="pageSubtitle()">
        <a mat-stroked-button routerLink="/matches">Volver a partidos</a>
      </app-page-header>

      <section class="card page-card app-page">
        @if (pageLoading()) {
          <app-loading-state />
        } @else if (pageError()) {
          <div class="empty-state">
            <strong>No se pudo cargar el partido.</strong>
            <p class="muted">{{ pageError() }}</p>
          </div>
        } @else {
          <div class="context-banner">
            <strong>{{ fixtureLabel() }}</strong>
            <span class="muted">{{ matchStatusLabel() }} / {{ scoreLabel() }}</span>
          </div>

          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="eventType">
                  @for (type of eventTypes; track type) {
                    <mat-option [value]="type">{{ eventTypeLabel(type) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Equipo</mat-label>
                <mat-select formControlName="tournamentTeamId">
                  <mat-option value="">Sin equipo</mat-option>
                  @for (item of matchTournamentTeams(); track item.id) {
                    <mat-option [value]="item.id">{{ tournamentTeamLabel(item.id) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Jugador</mat-label>
                <mat-select formControlName="playerId">
                  <mat-option value="">Sin jugador</mat-option>
                  @for (item of rosterPlayers(); track item.id) {
                    <mat-option [value]="item.id">{{ playerLabel(item.id) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Jugador relacionado</mat-label>
                <mat-select formControlName="relatedPlayerId">
                  <mat-option value="">Sin jugador relacionado</mat-option>
                  @for (item of rosterPlayers(); track item.id) {
                    <mat-option [value]="item.id">{{ playerLabel(item.id) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Periodo</mat-label>
                <input matInput formControlName="periodLabel" placeholder="1T">
                @if (form.controls.periodLabel.hasError('maxlength')) {
                  <mat-error>Maximo 20 caracteres.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Minuto</mat-label>
                <input matInput type="number" formControlName="eventMinute">
                @if (form.controls.eventMinute.hasError('min')) {
                  <mat-error>El minuto no puede ser negativo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Segundo</mat-label>
                <input matInput type="number" formControlName="eventSecond">
                @if (form.controls.eventSecond.hasError('min') || form.controls.eventSecond.hasError('max')) {
                  <mat-error>El segundo debe estar entre 0 y 59.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Valor</mat-label>
                <input matInput type="number" formControlName="eventValue">
                @if (form.controls.eventValue.hasError('min')) {
                  <mat-error>El valor debe ser mayor a 0.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Notas</mat-label>
                <textarea matInput rows="3" formControlName="notes"></textarea>
                @if (form.controls.notes.hasError('maxlength')) {
                  <mat-error>Maximo 500 caracteres.</mat-error>
                }
              </mat-form-field>
            </div>

            @if (form.hasError('requiredEventContext')) {
              <p class="muted">Este tipo requiere equipo, jugador y minuto.</p>
            }
            @if (form.hasError('requiredScoreValue')) {
              <p class="muted">Una anotacion requiere valor mayor a 0.</p>
            }
            @if (form.hasError('invalidSubstitution')) {
              <p class="muted">Una sustitucion requiere jugador relacionado distinto.</p>
            }
            @if (formError()) {
              <p class="muted">{{ formError() }}</p>
            }

            <div class="form-actions">
              @if (editingEventId()) {
                <button mat-stroked-button type="button" (click)="cancelEdit()">Cancelar edicion</button>
              }
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving() || !canManage()">
                {{ saving() ? 'Guardando...' : editingEventId() ? 'Guardar evento' : 'Registrar evento' }}
              </button>
            </div>
          </form>

          @if (loadingEvents()) {
            <app-loading-state />
          } @else if (eventsError()) {
            <div class="empty-state">
              <strong>No se pudieron cargar los eventos.</strong>
              <p class="muted">{{ eventsError() }}</p>
            </div>
          } @else if (events().length === 0) {
            <div class="empty-state">
              <strong>Este partido aun no tiene eventos.</strong>
              <p class="muted">Registra solo hechos operativos trazables permitidos por el contrato backend.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="events()" class="w-100">
                <ng-container matColumnDef="time">
                  <th mat-header-cell *matHeaderCellDef>Tiempo</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <strong>{{ eventTimeLabel(row) }}</strong>
                      <span class="muted">{{ formatDate(row.createdAt) }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Evento</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <strong>{{ eventTypeLabel(row.eventType) }}</strong>
                      <span [class]="eventStatusClass(row.status)">{{ eventStatusLabel(row.status) }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="subject">
                  <th mat-header-cell *matHeaderCellDef>Detalle</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <span>{{ row.tournamentTeamId ? tournamentTeamLabel(row.tournamentTeamId) : 'Sin equipo' }}</span>
                      <span class="muted">{{ row.playerId ? playerLabel(row.playerId) : 'Sin jugador' }}</span>
                      @if (row.relatedPlayerId) {
                        <span class="muted">Relacionado: {{ playerLabel(row.relatedPlayerId) }}</span>
                      }
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="value">
                  <th mat-header-cell *matHeaderCellDef>Valor</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="stack-sm">
                      <span>{{ row.eventValue ?? '-' }}</span>
                      <span class="muted">{{ row.notes || 'Sin notas' }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let row">
                    @if (canManage() && row.status === 'ACTIVE') {
                      <button mat-button type="button" (click)="edit(row)">Editar</button>
                      <button mat-button color="warn" type="button" (click)="annul(row)">Anular</button>
                    } @else {
                      <span class="muted">Sin acciones</span>
                    }
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
              </table>
            </div>
          }
        }
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchEventsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly matchesService = inject(MatchesService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly teamsService = inject(TeamsService);
  private readonly playersService = inject(PlayersService);
  private readonly rostersService = inject(RostersService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly matchId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly pageLoading = signal(true);
  protected readonly loadingEvents = signal(true);
  protected readonly saving = signal(false);
  protected readonly pageError = signal('');
  protected readonly eventsError = signal('');
  protected readonly formError = signal('');
  protected readonly match = signal<MatchGame | null>(null);
  protected readonly events = signal<MatchEvent[]>([]);
  private readonly allTournamentTeams = signal<TournamentTeam[]>([]);
  private readonly allTeams = signal<Team[]>([]);
  private readonly allPlayers = signal<Player[]>([]);
  private readonly allRosters = signal<RosterEntry[]>([]);
  private readonly selectedTournamentTeamId = signal(0);
  protected readonly editingEventId = signal(0);
  protected readonly canManage = computed(() => this.authorization.canManage('matches'));
  protected readonly displayedColumns = ['time', 'type', 'subject', 'value', 'actions'];
  protected readonly eventTypes: MatchEventType[] = ['SCORE', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'INCIDENT', 'NOTE'];
  protected readonly matchTournamentTeams = computed(() => {
    const current = this.match();
    if (!current) {
      return [];
    }

    const matchTeamIds = new Set([current.homeTournamentTeamId, current.awayTournamentTeamId]);
    return this.allTournamentTeams().filter((item) => matchTeamIds.has(item.id));
  });
  protected readonly rosterPlayers = computed(() => {
    const selectedTeamId = this.selectedTournamentTeamId();
    const matchTeamIds = new Set(this.matchTournamentTeams().map((item) => item.id));
    const rosters = this.allRosters().filter(
      (item) => item.rosterStatus === 'ACTIVE' && (!selectedTeamId || item.tournamentTeamId === selectedTeamId)
    );

    return rosters
      .filter((item) => matchTeamIds.has(item.tournamentTeamId))
      .map((item) => this.allPlayers().find((player) => player.id === item.playerId))
      .filter((item): item is Player => Boolean(item));
  });
  protected readonly pageSubtitle = computed(() => {
    const current = this.match();
    if (!current) {
      return 'Captura acotada de eventos trazables por partido.';
    }

    return `Partido #${current.id} / ${this.matchStatusLabel()}`;
  });
  protected readonly fixtureLabel = computed(() => {
    const current = this.match();
    if (!current) {
      return 'Partido no disponible';
    }

    return `${this.tournamentTeamLabel(current.homeTournamentTeamId)} vs ${this.tournamentTeamLabel(current.awayTournamentTeamId)}`;
  });

  protected readonly form = this.fb.nonNullable.group(
    {
      eventType: ['SCORE' as MatchEventType, Validators.required],
      tournamentTeamId: [''],
      playerId: [''],
      relatedPlayerId: [''],
      periodLabel: ['', [Validators.maxLength(20)]],
      eventMinute: ['', [Validators.min(0)]],
      eventSecond: ['', [Validators.min(0), Validators.max(59)]],
      eventValue: ['', [Validators.min(1)]],
      notes: ['', [Validators.maxLength(500)]]
    },
    { validators: [eventRulesValidator] }
  );

  constructor() {
    this.form.controls.tournamentTeamId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.selectedTournamentTeamId.set(Number(value));
      const validPlayerIds = new Set(this.rosterPlayers().map((item) => item.id));
      const selectedPlayerId = Number(this.form.controls.playerId.getRawValue());
      const relatedPlayerId = Number(this.form.controls.relatedPlayerId.getRawValue());

      if (selectedPlayerId && !validPlayerIds.has(selectedPlayerId)) {
        this.form.patchValue({ playerId: '' }, { emitEvent: false });
      }

      if (relatedPlayerId && !validPlayerIds.has(relatedPlayerId)) {
        this.form.patchValue({ relatedPlayerId: '' }, { emitEvent: false });
      }
    });

    this.loadMatch();
    this.loadEvents();
    this.loadCatalogs();
  }

  protected save(): void {
    this.form.markAllAsTouched();
    this.formError.set('');

    if (this.form.invalid || this.saving() || !this.canManage()) {
      return;
    }

    const payload = this.buildPayload();
    this.saving.set(true);
    const request$ = this.editingEventId()
      ? this.matchesService.updateEvent(this.matchId, this.editingEventId(), payload)
      : this.matchesService.createEvent(this.matchId, payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success(this.editingEventId() ? 'Evento actualizado correctamente' : 'Evento registrado correctamente');
        this.resetForm();
        this.loadEvents();
      },
      error: (error: unknown) => {
        const appError = this.errorMapper.map(error);
        this.formError.set(appError.message);
        this.notifications.error(appError.message);
      }
    });
  }

  protected edit(event: MatchEvent): void {
    if (event.status !== 'ACTIVE') {
      return;
    }

    this.editingEventId.set(event.id);
    this.form.patchValue({
      eventType: event.eventType,
      tournamentTeamId: event.tournamentTeamId ? String(event.tournamentTeamId) : '',
      playerId: event.playerId ? String(event.playerId) : '',
      relatedPlayerId: event.relatedPlayerId ? String(event.relatedPlayerId) : '',
      periodLabel: event.periodLabel ?? '',
      eventMinute: event.eventMinute !== null ? String(event.eventMinute) : '',
      eventSecond: event.eventSecond !== null ? String(event.eventSecond) : '',
      eventValue: event.eventValue !== null ? String(event.eventValue) : '',
      notes: event.notes ?? ''
    });
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected annul(event: MatchEvent): void {
    const notes = window.prompt('Motivo de anulacion', 'Correccion operativa');
    if (notes === null) {
      return;
    }

    this.loadingEvents.set(true);
    this.matchesService
      .annulEvent(this.matchId, event.id, { notes: notes || null })
      .pipe(finalize(() => this.loadingEvents.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Evento anulado correctamente');
          this.loadEvents();
        },
        error: (error: unknown) => {
          const appError = this.errorMapper.map(error);
          this.eventsError.set(appError.message);
          this.notifications.error(appError.message);
        }
      });
  }

  protected tournamentTeamLabel(tournamentTeamId: number): string {
    const registration = this.allTournamentTeams().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `Equipo torneo #${tournamentTeamId}`;
    }

    const team = this.allTeams().find((item) => item.id === registration.teamId);
    return team ? `${team.name} (#${registration.id})` : `Equipo ${registration.teamId} (#${registration.id})`;
  }

  protected playerLabel(playerId: number): string {
    const player = this.allPlayers().find((item) => item.id === playerId);
    return player ? `${player.firstName} ${player.lastName}` : `Jugador #${playerId}`;
  }

  protected eventTypeLabel(type: MatchEventType): string {
    const labels: Record<MatchEventType, string> = {
      SCORE: 'Anotacion',
      YELLOW_CARD: 'Tarjeta amarilla',
      RED_CARD: 'Tarjeta roja',
      SUBSTITUTION: 'Sustitucion',
      INCIDENT: 'Incidencia',
      NOTE: 'Observacion'
    };

    return labels[type];
  }

  protected eventStatusLabel(status: MatchEvent['status']): string {
    return status === 'ACTIVE' ? 'Activo' : 'Anulado';
  }

  protected eventStatusClass(status: MatchEvent['status']): string {
    return `status-pill ${status === 'ACTIVE' ? 'played' : 'cancelled'}`;
  }

  protected eventTimeLabel(event: MatchEvent): string {
    const period = event.periodLabel ? `${event.periodLabel} ` : '';
    const minute = event.eventMinute !== null ? `${event.eventMinute}'` : 'Sin minuto';
    const second = event.eventSecond !== null ? `:${String(event.eventSecond).padStart(2, '0')}` : '';
    return `${period}${minute}${second}`;
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

  protected matchStatusLabel(): string {
    const current = this.match();
    if (!current) {
      return 'Estado no disponible';
    }

    const labels: Record<MatchGame['status'], string> = {
      SCHEDULED: 'Programado',
      PLAYED: 'Jugado',
      FORFEIT: 'Forfeit',
      CANCELLED: 'Cancelado'
    };

    return labels[current.status];
  }

  protected scoreLabel(): string {
    const current = this.match();
    if (!current || current.homeScore === null || current.awayScore === null) {
      return 'Marcador pendiente';
    }

    return `${current.homeScore} - ${current.awayScore}`;
  }

  private loadMatch(): void {
    this.pageLoading.set(true);
    this.pageError.set('');
    this.matchesService
      .getById(this.matchId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (match) => this.match.set(match),
        error: (error: unknown) => {
          const appError = this.errorMapper.map(error);
          this.pageError.set(appError.message);
          this.notifications.error(appError.message);
        }
      });
  }

  private loadEvents(): void {
    this.loadingEvents.set(true);
    this.eventsError.set('');
    this.matchesService
      .listEvents(this.matchId)
      .pipe(finalize(() => this.loadingEvents.set(false)))
      .subscribe({
        next: (events) => this.events.set(events),
        error: (error: unknown) => {
          const appError = this.errorMapper.map(error);
          this.eventsError.set(appError.message);
          this.notifications.error(appError.message);
        }
      });
  }

  private loadCatalogs(): void {
    this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ page, size })).subscribe({
      next: (items) => this.allTournamentTeams.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })).subscribe({
      next: (items) => this.allTeams.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.playersService.list({ page, size })).subscribe({
      next: (items) => this.allPlayers.set(items)
    });
    this.catalogLoader.loadAll((page, size) => this.rostersService.list({ page, size })).subscribe({
      next: (items) => this.allRosters.set(items)
    });
  }

  private buildPayload(): MatchEventFormValue {
    const value = this.form.getRawValue();
    return {
      eventType: value.eventType,
      tournamentTeamId: parseOptionalNumber(value.tournamentTeamId),
      playerId: parseOptionalNumber(value.playerId),
      relatedPlayerId: parseOptionalNumber(value.relatedPlayerId),
      periodLabel: value.periodLabel || null,
      eventMinute: parseOptionalNumber(value.eventMinute),
      eventSecond: parseOptionalNumber(value.eventSecond),
      eventValue: parseOptionalNumber(value.eventValue),
      notes: value.notes || null
    };
  }

  private resetForm(): void {
    this.editingEventId.set(0);
    this.formError.set('');
    this.form.reset({
      eventType: 'SCORE',
      tournamentTeamId: '',
      playerId: '',
      relatedPlayerId: '',
      periodLabel: '',
      eventMinute: '',
      eventSecond: '',
      eventValue: '',
      notes: ''
    });
  }
}
