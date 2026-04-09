import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { MatchGame } from '../matches/match.models';
import { MatchesService } from '../matches/matches.service';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import { DisciplinarySanction, DisciplinarySanctionStatus } from './discipline.models';
import { DisciplineService } from './discipline.service';

@Component({
  selector: 'app-discipline-tournament-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header title="Sanciones disciplinarias" [subtitle]="headerSubtitle()">
        <div class="header-actions">
          <a mat-stroked-button [routerLink]="['/tournaments', tournamentId()]">Volver al torneo</a>
          <a mat-stroked-button routerLink="/matches" [queryParams]="{ tournamentId: tournamentId() }">Ver partidos</a>
        </div>
      </app-page-header>

      @if (loading()) {
        <app-loading-state label="Cargando sanciones..." />
      } @else if (!tournament()) {
        <section class="card page-card app-page">
          <div class="empty-state">
            <strong>No se encontro el torneo solicitado.</strong>
            <p class="muted">Abre sanciones desde el detalle de un torneo para conservar el contexto oficial.</p>
          </div>
        </section>
      } @else {
        <section class="card page-card app-page">
          <div class="context-banner">
            <strong>{{ tournament()!.name }}</strong>
            <span class="muted">Lectura acotada de sanciones por torneo, con disponibilidad y estado trazable.</span>
          </div>

          <form [formGroup]="filtersForm" class="filter-row">
            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">Todos</mat-option>
                @for (status of statuses; track status) {
                  <mat-option [value]="status">{{ sanctionStatusLabel(status) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Equipo</mat-label>
              <mat-select formControlName="teamId">
                <mat-option value="">Todos</mat-option>
                @for (team of teams(); track team.id) {
                  <mat-option [value]="team.id">{{ team.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-checkbox formControlName="activeOnly">Solo activas</mat-checkbox>
          </form>

          <div class="actions-row">
            <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
            <button mat-flat-button color="primary" type="button" (click)="loadSanctions()">Actualizar lectura</button>
          </div>

          <div class="summary-grid">
            <article class="summary-card card accent">
              <span class="summary-label">Sanciones</span>
              <span class="summary-value">{{ totalSanctions() }}</span>
              <span class="summary-meta">Total visible</span>
            </article>
            <article class="summary-card card">
              <span class="summary-label">Activas</span>
              <span class="summary-value">{{ activeSanctionsCount() }}</span>
              <span class="summary-meta">Con cumplimiento pendiente</span>
            </article>
            <article class="summary-card card">
              <span class="summary-label">Partidos pendientes</span>
              <span class="summary-value">{{ remainingMatchesCount() }}</span>
              <span class="summary-meta">Pendientes de cumplimiento</span>
            </article>
          </div>
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Lectura disciplinaria</h2>
              <p class="muted">Sanciones simples derivadas de incidencias, sin tribunal ni tablero transversal.</p>
            </div>
          </div>

          @if (sanctions().length === 0) {
            <div class="empty-state">
              <strong>No hay sanciones para este filtro.</strong>
              <p class="muted">Las incidencias sin sancion adicional no aparecen en esta lectura por torneo.</p>
            </div>
          } @else {
            <div class="list-stack">
              @for (sanction of sanctions(); track sanction.sanctionId) {
                <article class="list-card">
                  <div class="section-heading compact">
                    <strong>{{ sanctionTypeLabel(sanction.sanctionType) }}</strong>
                    <span [class]="sanctionStatusClass(sanction.status)">{{ sanctionStatusLabel(sanction.status) }}</span>
                  </div>
                  <span>{{ sanctionPlayerName(sanction) }}</span>
                  <span class="muted">{{ sanctionTeamLabel(sanction) }} · {{ matchLabel(sanction.matchId ?? null) }}</span>
                  <span class="muted">{{ sanction.matchesServed }}/{{ sanction.matchesToServe }} cumplido(s), {{ sanction.remainingMatches }} pendiente(s)</span>
                  @if (sanction.matchId) {
                    <div class="inline-actions">
                      <a mat-button [routerLink]="['/matches', sanction.matchId, 'discipline']">Abrir partido</a>
                    </div>
                  }
                </article>
              }
            </div>
          }
        </section>
      }
    </section>
  `,
  styles: [
    `
      .header-actions,
      .section-heading,
      .inline-actions {
        display: flex;
        gap: 0.75rem;
        align-items: start;
        justify-content: space-between;
      }

      .header-actions,
      .inline-actions {
        flex-wrap: wrap;
      }

      .filter-row {
        align-items: center;
      }

      .section-heading h2,
      .section-heading p {
        margin: 0;
      }

      .compact {
        align-items: center;
      }

      .list-stack {
        display: grid;
        gap: 1rem;
      }

      .list-card {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
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
export class DisciplineTournamentPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly disciplineService = inject(DisciplineService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly teamsService = inject(TeamsService);
  private readonly matchesService = inject(MatchesService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly tournamentId = signal(Number(this.route.snapshot.paramMap.get('id') ?? 0));
  protected readonly loading = signal(true);
  protected readonly tournament = signal<Tournament | null>(null);
  protected readonly sanctions = signal<DisciplinarySanction[]>([]);
  protected readonly totalSanctions = signal(0);
  private readonly registrations = signal<TournamentTeam[]>([]);
  protected readonly teams = signal<Team[]>([]);
  private readonly matches = signal<MatchGame[]>([]);
  protected readonly statuses: DisciplinarySanctionStatus[] = ['ACTIVE', 'SERVED', 'CANCELLED'];
  protected readonly filtersForm = this.fb.nonNullable.group({
    status: ['' as DisciplinarySanctionStatus | ''],
    teamId: [0 as number | ''],
    activeOnly: [true]
  });
  protected readonly headerSubtitle = computed(() => {
    const tournament = this.tournament();
    return tournament ? `${tournament.name} · lectura visible acotada` : 'Lectura disciplinaria visible acotada por torneo.';
  });
  protected readonly activeSanctionsCount = computed(() => this.sanctions().filter((item) => item.status === 'ACTIVE').length);
  protected readonly remainingMatchesCount = computed(() =>
    this.sanctions().reduce((total, item) => total + (item.remainingMatches ?? 0), 0)
  );

  constructor() {
    this.loadContext();
  }

  protected loadContext(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      this.loading.set(false);
      this.tournament.set(null);
      return;
    }

    this.loading.set(true);
    forkJoin({
      tournament: this.tournamentsService.getById(tournamentId),
      registrations: this.catalogLoader.loadAll((page, size) => this.tournamentTeamsService.list({ tournamentId, page, size })),
      teams: this.catalogLoader.loadAll((page, size) => this.teamsService.list({ page, size })),
      matches: this.catalogLoader.loadAll((page, size) => this.matchesService.list({ tournamentId, page, size })),
      sanctions: this.disciplineService.listTournamentSanctions(tournamentId, this.filtersForm.getRawValue())
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const teamIds = new Set(result.registrations.map((item) => item.teamId));
          this.tournament.set(result.tournament);
          this.registrations.set(result.registrations);
          this.teams.set(result.teams.filter((item) => teamIds.has(item.id)));
          this.matches.set(result.matches);
          this.sanctions.set(result.sanctions.sanctions);
          this.totalSanctions.set(result.sanctions.totalSanctions);
        },
        error: (error: unknown) => {
          this.tournament.set(null);
          this.sanctions.set([]);
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }

  protected loadSanctions(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      return;
    }

    this.loading.set(true);
    this.disciplineService
      .listTournamentSanctions(tournamentId, this.filtersForm.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.sanctions.set(result.sanctions);
          this.totalSanctions.set(result.totalSanctions);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ status: '', teamId: '', activeOnly: true });
    this.loadSanctions();
  }

  protected tournamentTeamLabel(tournamentTeamId: number): string {
    const registration = this.registrations().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `Inscripcion #${tournamentTeamId}`;
    }

    return this.teams().find((item) => item.id === registration.teamId)?.name ?? `Equipo ${registration.teamId}`;
  }

  protected sanctionPlayerName(sanction: DisciplinarySanction): string {
    return sanction.player?.fullName ?? sanction.playerName ?? `Jugador ${sanction.player?.playerId ?? sanction.playerId ?? 0}`;
  }

  protected sanctionTeamLabel(sanction: DisciplinarySanction): string {
    return this.tournamentTeamLabel(sanction.team?.tournamentTeamId ?? sanction.tournamentTeamId ?? 0);
  }

  protected matchLabel(matchId: number | null): string {
    if (!matchId) {
      return 'Partido origen no declarado';
    }

    const match = this.matches().find((item) => item.id === matchId);
    if (!match) {
      return `Partido #${matchId}`;
    }

    return `${this.tournamentTeamLabel(match.homeTournamentTeamId)} vs ${this.tournamentTeamLabel(match.awayTournamentTeamId)} · ${this.formatDate(match.scheduledAt)}`;
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

  protected formatDate(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    if (!parsed) {
      return 'sin fecha';
    }

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(parsed);
  }
}
