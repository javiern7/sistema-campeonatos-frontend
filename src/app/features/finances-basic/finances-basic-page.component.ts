import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule } from '@angular/material/core';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { PICHANGA_DATE_PICKER_PROVIDERS, toBackendDate, todayDateOnly } from '../../shared/date/date-only.utils';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { Team } from '../teams/team.models';
import { TeamsService } from '../teams/teams.service';
import { TournamentTeam } from '../tournament-teams/tournament-team.models';
import { TournamentTeamsService } from '../tournament-teams/tournament-teams.service';
import { Tournament } from '../tournaments/tournament.models';
import { TournamentsService } from '../tournaments/tournaments.service';
import {
  BasicFinancialSummary,
  FinancialMovement,
  FinancialMovementCategory,
  FinancialMovementType
} from './finances-basic.models';
import { FinancesBasicService } from './finances-basic.service';

type SummaryCard = {
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
};

const incomeCategories: FinancialMovementCategory[] = [
  'INSCRIPCION_EQUIPO',
  'APORTE_SIMPLE',
  'PATROCINIO_SIMPLE',
  'OTRO_INGRESO_OPERATIVO'
];

const expenseCategories: FinancialMovementCategory[] = [
  'ARBITRAJE',
  'CANCHA',
  'LOGISTICA',
  'PREMIOS',
  'OTRO_GASTO_OPERATIVO'
];

@Component({
  selector: 'app-finances-basic-page',
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
    PageHeaderComponent
  ],
  providers: PICHANGA_DATE_PICKER_PROVIDERS,
  template: `
    <section class="app-page">
      <app-page-header title="Finanzas basicas" [subtitle]="headerSubtitle()">
        <div class="header-actions">
          <a mat-stroked-button [routerLink]="['/tournaments', tournamentId()]">Volver al torneo</a>
          <a mat-stroked-button routerLink="/tournament-teams" [queryParams]="{ tournamentId: tournamentId() }">Ver inscripciones</a>
        </div>
      </app-page-header>

      @if (loading()) {
        <app-loading-state label="Cargando lectura financiera..." />
      } @else if (!tournament()) {
        <section class="card page-card app-page">
          <div class="empty-state">
            <strong>No se encontro el torneo solicitado.</strong>
            <p class="muted">Abre finanzas desde el detalle del torneo o desde el modulo lateral para conservar el contexto oficial.</p>
          </div>
        </section>
      } @else {
        <section class="card page-card app-page">
          <div class="context-banner">
            <strong>{{ tournament()!.name }}</strong>
            <span class="muted">Ingresos, gastos y balance operativo simple; sin caja, facturacion ni contabilidad formal.</span>
          </div>

          @if (summary()) {
            <div class="summary-grid">
              @for (card of summaryCards(); track card.label) {
                <article class="summary-card card" [class.accent]="card.accent">
                  <span class="summary-label">{{ card.label }}</span>
                  <span class="summary-value">{{ card.value }}</span>
                  <span class="summary-meta">{{ card.meta }}</span>
                </article>
              }
            </div>
          }

          <div class="context-banner neutral-banner">
            <strong>Guardrail operativo</strong>
            <span class="muted">El resumen sale de backend; esta pantalla no recalcula contabilidad ni crea semantica financiera paralela.</span>
          </div>
        </section>

        <section class="content-grid">
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Movimientos</h2>
                <p class="muted">Trazabilidad simple por torneo y equipo cuando el ingreso lo declara.</p>
              </div>
              <span class="muted">{{ movementsTotalLabel() }}</span>
            </div>

            <form [formGroup]="filtersForm" class="filter-row">
              <mat-form-field appearance="outline">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="movementType">
                  <mat-option value="">Todos</mat-option>
                  @for (type of movementTypes; track type) {
                    <mat-option [value]="type">{{ movementTypeLabel(type) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Categoria</mat-label>
                <mat-select formControlName="category">
                  <mat-option value="">Todas</mat-option>
                  @for (category of filterCategories(); track category) {
                    <mat-option [value]="category">{{ categoryLabel(category) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Equipo</mat-label>
                <mat-select formControlName="tournamentTeamId">
                  <mat-option value="">Todos</mat-option>
                  @for (registration of registrations(); track registration.id) {
                    <mat-option [value]="registration.id">{{ tournamentTeamLabel(registration.id) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </form>

            <div class="actions-row">
              <button mat-stroked-button type="button" (click)="resetFilters()">Limpiar</button>
              <button mat-flat-button color="primary" type="button" (click)="loadMovements()">Actualizar</button>
            </div>

            @if (movements().length === 0) {
              <div class="empty-state">
                <strong>No hay movimientos para este filtro.</strong>
                <p class="muted">Registra un ingreso o gasto simple si el torneo ya tiene informacion financiera operativa.</p>
              </div>
            } @else {
              <div class="list-stack">
                @for (movement of movements(); track movement.movementId) {
                  <article class="movement-card">
                    <div class="section-heading compact">
                      <strong>{{ categoryLabel(movement.category) }}</strong>
                      <span [class]="movementTypeClass(movement.movementType)">{{ movementTypeLabel(movement.movementType) }}</span>
                    </div>
                    <span class="movement-amount">{{ moneyLabel(movement.amount) }}</span>
                    <span class="muted">{{ movementTeamLabel(movement) }} · {{ movement.occurredOn }}</span>
                    @if (movement.description || movement.referenceCode) {
                      <span class="muted">{{ movement.description || 'Sin descripcion' }}{{ movement.referenceCode ? ' · Ref. ' + movement.referenceCode : '' }}</span>
                    }
                  </article>
                }
              </div>
            }
          </section>

          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Nuevo movimiento</h2>
                <p class="muted">Alta acotada segun el contrato vigente de finanzas basicas.</p>
              </div>
            </div>

            @if (!canManage()) {
              <div class="empty-state">
                <strong>Lectura solamente.</strong>
                <p class="muted">Tu sesion puede leer finanzas del torneo, pero no registrar movimientos nuevos.</p>
              </div>
            } @else {
              <form [formGroup]="movementForm" class="movement-form">
                <mat-form-field appearance="outline">
                  <mat-label>Tipo</mat-label>
                  <mat-select formControlName="movementType">
                    @for (type of movementTypes; track type) {
                      <mat-option [value]="type">{{ movementTypeLabel(type) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Categoria</mat-label>
                  <mat-select formControlName="category">
                    @for (category of formCategories(); track category) {
                      <mat-option [value]="category">{{ categoryLabel(category) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                @if (movementForm.controls.movementType.getRawValue() === 'INCOME') {
                  <mat-form-field appearance="outline">
                    <mat-label>Equipo asociado</mat-label>
                    <mat-select formControlName="tournamentTeamId">
                      <mat-option value="">Torneo completo</mat-option>
                      @for (registration of registrations(); track registration.id) {
                        <mat-option [value]="registration.id">{{ tournamentTeamLabel(registration.id) }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                }

                <mat-form-field appearance="outline">
                  <mat-label>Monto</mat-label>
                  <input matInput type="number" min="0.01" step="0.01" formControlName="amount">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha</mat-label>
                  <input matInput [matDatepicker]="occurredOnPicker" formControlName="occurredOn" placeholder="dd/mm/aaaa">
                  <mat-datepicker-toggle matIconSuffix [for]="occurredOnPicker" />
                  <mat-datepicker #occurredOnPicker />
                  <mat-hint>dd/mm/aaaa</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Referencia</mat-label>
                  <input matInput maxlength="80" formControlName="referenceCode">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Descripcion</mat-label>
                  <textarea matInput maxlength="300" rows="3" formControlName="description"></textarea>
                </mat-form-field>
              </form>

              <div class="actions-row">
                <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="createMovement()">
                  {{ saving() ? 'Guardando...' : 'Registrar movimiento' }}
                </button>
              </div>
            }
          </section>

          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Desglose</h2>
                <p class="muted">Categorias e ingresos por equipo entregados por el resumen backend.</p>
              </div>
            </div>

            @if (!summary()) {
              <div class="empty-state">
                <strong>Sin resumen disponible.</strong>
                <p class="muted">Actualiza la lectura cuando el backend este disponible.</p>
              </div>
            } @else {
              <div class="split-grid">
                <div class="list-stack">
                  <strong>Por categoria</strong>
                  @for (item of summary()!.byCategory; track item.movementType + item.category) {
                    <article class="breakdown-card">
                      <span>{{ categoryLabel(item.category) }}</span>
                      <strong>{{ moneyLabel(item.totalAmount) }}</strong>
                      <span class="muted">{{ movementTypeLabel(item.movementType) }} · {{ item.movementCount }} movimiento(s)</span>
                    </article>
                  }
                </div>

                <div class="list-stack">
                  <strong>Ingresos por equipo</strong>
                  @if (summary()!.incomeByTeam.length === 0) {
                    <article class="breakdown-card">
                      <span class="muted">Sin ingresos asociados a equipos.</span>
                    </article>
                  } @else {
                    @for (item of summary()!.incomeByTeam; track item.team.tournamentTeamId) {
                      <article class="breakdown-card">
                        <span>{{ item.team.name }}</span>
                        <strong>{{ moneyLabel(item.incomeTotal) }}</strong>
                        <span class="muted">{{ item.movementCount }} ingreso(s)</span>
                      </article>
                    }
                  }
                </div>
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
      .list-stack,
      .movement-form {
        display: grid;
        gap: 1rem;
      }

      .movement-form,
      .split-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .split-grid {
        display: grid;
        gap: 1rem;
      }

      .neutral-banner {
        background: linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(14, 116, 144, 0.02));
        border-color: rgba(14, 116, 144, 0.16);
      }

      .section-heading h2,
      .section-heading p {
        margin: 0;
      }

      .compact {
        align-items: center;
      }

      .movement-card,
      .breakdown-card {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .movement-amount {
        font-size: 1.6rem;
        font-weight: 700;
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
export class FinancesBasicPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly financesService = inject(FinancesBasicService);
  private readonly tournamentsService = inject(TournamentsService);
  private readonly tournamentTeamsService = inject(TournamentTeamsService);
  private readonly teamsService = inject(TeamsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly tournamentId = signal(0);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly tournament = signal<Tournament | null>(null);
  protected readonly summary = signal<BasicFinancialSummary | null>(null);
  protected readonly movements = signal<FinancialMovement[]>([]);
  protected readonly totalMovements = signal(0);
  protected readonly registrations = signal<TournamentTeam[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly movementTypes: FinancialMovementType[] = ['INCOME', 'EXPENSE'];
  protected readonly canManage = computed(() => this.authorization.canManage('tournaments'));
  protected readonly headerSubtitle = computed(() => {
    const tournament = this.tournament();
    return tournament ? `${tournament.name} · lectura financiera acotada` : 'Ingresos, gastos y balance simple por torneo.';
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const summary = this.summary();
    if (!summary) {
      return [];
    }

    return [
      {
        label: 'Ingresos',
        value: this.moneyLabel(summary.totalIncome),
        meta: 'Total operativo simple',
        accent: true
      },
      {
        label: 'Gastos',
        value: this.moneyLabel(summary.totalExpense),
        meta: 'Solo nivel torneo'
      },
      {
        label: 'Balance',
        value: this.moneyLabel(summary.balance),
        meta: `${summary.movementCount} movimiento(s)`
      }
    ];
  });
  protected readonly filterCategories = computed(() => {
    const type = this.filtersForm.controls.movementType.getRawValue();
    if (type === 'INCOME') {
      return incomeCategories;
    }
    if (type === 'EXPENSE') {
      return expenseCategories;
    }
    return [...incomeCategories, ...expenseCategories];
  });
  protected readonly formCategories = computed(() =>
    this.movementForm.controls.movementType.getRawValue() === 'INCOME' ? incomeCategories : expenseCategories
  );
  protected readonly filtersForm = this.fb.nonNullable.group({
    movementType: ['' as FinancialMovementType | ''],
    category: ['' as FinancialMovementCategory | ''],
    tournamentTeamId: ['' as number | '']
  });
  protected readonly movementForm = this.fb.nonNullable.group({
    movementType: ['INCOME' as FinancialMovementType, Validators.required],
    category: ['INSCRIPCION_EQUIPO' as FinancialMovementCategory, Validators.required],
    tournamentTeamId: ['' as number | ''],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    occurredOn: [todayDateOnly(), Validators.required],
    referenceCode: [''],
    description: ['']
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.tournamentId.set(Number(params.get('id')));
      this.loadContext();
    });

    this.filtersForm.controls.movementType.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      const currentCategory = this.filtersForm.controls.category.getRawValue();
      const validCategories = type === 'INCOME' ? incomeCategories : type === 'EXPENSE' ? expenseCategories : this.filterCategories();
      if (currentCategory && !validCategories.includes(currentCategory)) {
        this.filtersForm.patchValue({ category: '' }, { emitEvent: false });
      }
    });

    this.movementForm.controls.movementType.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      this.movementForm.patchValue(
        {
          category: type === 'INCOME' ? 'INSCRIPCION_EQUIPO' : 'ARBITRAJE',
          tournamentTeamId: type === 'INCOME' ? this.movementForm.controls.tournamentTeamId.getRawValue() : ''
        },
        { emitEvent: false }
      );
    });
  }

  protected loadMovements(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId) {
      return;
    }

    this.loading.set(true);
    this.financesService
      .listMovements(tournamentId, this.cleanMovementFilters())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.movements.set(result.movements);
          this.totalMovements.set(result.totalMovements);
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected resetFilters(): void {
    this.filtersForm.setValue({ movementType: '', category: '', tournamentTeamId: '' });
    this.loadMovements();
  }

  protected createMovement(): void {
    const tournamentId = this.tournamentId();
    if (!tournamentId || this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }

    const formValue = this.movementForm.getRawValue();
    this.saving.set(true);
    this.financesService
      .createMovement(tournamentId, {
        tournamentTeamId:
          formValue.movementType === 'INCOME' ? this.cleanTournamentTeamId(formValue.tournamentTeamId) : null,
        movementType: formValue.movementType,
        category: formValue.category,
        amount: Number(formValue.amount),
        occurredOn: toBackendDate(formValue.occurredOn) ?? '',
        description: formValue.description.trim() || null,
        referenceCode: formValue.referenceCode.trim() || null
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Movimiento financiero creado correctamente');
          this.movementForm.patchValue({
            amount: 0,
            description: '',
            referenceCode: ''
          });
          this.loadContext();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected movementsTotalLabel(): string {
    return `${this.totalMovements()} movimiento(s)`;
  }

  protected tournamentTeamLabel(tournamentTeamId: number): string {
    const registration = this.registrations().find((item) => item.id === tournamentTeamId);
    if (!registration) {
      return `Inscripcion #${tournamentTeamId}`;
    }

    const team = this.teams().find((item) => item.id === registration.teamId);
    return team ? `${team.name} (#${registration.id})` : `Equipo ${registration.teamId} (#${registration.id})`;
  }

  protected movementTeamLabel(movement: FinancialMovement): string {
    if (movement.team?.name) {
      return `${movement.team.name} (#${movement.team.tournamentTeamId})`;
    }

    return movement.movementType === 'EXPENSE' ? 'Gasto del torneo' : 'Ingreso del torneo';
  }

  protected movementTypeLabel(type: FinancialMovementType): string {
    return type === 'INCOME' ? 'Ingreso' : 'Gasto';
  }

  protected movementTypeClass(type: FinancialMovementType): string {
    return type === 'INCOME' ? 'status-pill played' : 'status-pill forfeit';
  }

  protected categoryLabel(category: FinancialMovementCategory): string {
    const labels: Record<FinancialMovementCategory, string> = {
      INSCRIPCION_EQUIPO: 'Inscripcion de equipo',
      APORTE_SIMPLE: 'Aporte simple',
      PATROCINIO_SIMPLE: 'Patrocinio simple',
      OTRO_INGRESO_OPERATIVO: 'Otro ingreso operativo',
      ARBITRAJE: 'Arbitraje',
      CANCHA: 'Cancha',
      LOGISTICA: 'Logistica',
      PREMIOS: 'Premios',
      OTRO_GASTO_OPERATIVO: 'Otro gasto operativo'
    };

    return labels[category];
  }

  protected moneyLabel(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value ?? 0);
  }

  private loadContext(): void {
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
      summary: this.financesService.getSummary(tournamentId),
      movements: this.financesService.listMovements(tournamentId, this.cleanMovementFilters())
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const teamIds = new Set(result.registrations.map((item) => item.teamId));
          this.tournament.set(result.tournament);
          this.registrations.set(result.registrations);
          this.teams.set(result.teams.filter((item) => teamIds.has(item.id)));
          this.summary.set(result.summary);
          this.movements.set(result.movements.movements);
          this.totalMovements.set(result.movements.totalMovements);
        },
        error: (error: unknown) => {
          this.tournament.set(null);
          this.summary.set(null);
          this.movements.set([]);
          this.notifications.error(this.errorMapper.map(error).message);
        }
      });
  }

  private cleanMovementFilters(): {
    movementType: FinancialMovementType | '';
    category: FinancialMovementCategory | '';
    tournamentTeamId: number | '';
  } {
    const filters = this.filtersForm.getRawValue();
    return {
      movementType: filters.movementType,
      category: filters.category,
      tournamentTeamId: this.cleanTournamentTeamId(filters.tournamentTeamId) ?? ''
    };
  }

  private cleanTournamentTeamId(value: number | '' | null | undefined): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
}
