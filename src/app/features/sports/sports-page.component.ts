import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';

import { AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { CompetitionFormat, Sport, SportPosition } from './sport.models';
import { SportsService } from './sports.service';

@Component({
  selector: 'app-sports-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header
        title="Configuracion multideporte"
        subtitle="Catalogos maestros para deportes, posiciones por deporte y formatos de competencia."
      />

      <section class="card page-card app-page">
        <div class="context-banner">
          <strong>Alcance V4</strong>
          <span class="muted">
            Configuracion maestra interna. No incluye eventos de partido, estadisticas derivadas ni reporterias.
          </span>
        </div>

        <div class="settings-grid">
          <form [formGroup]="sportForm" (ngSubmit)="saveSport()" class="config-panel">
            <h2>{{ editingSport() ? 'Editar deporte' : 'Nuevo deporte' }}</h2>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Codigo</mat-label>
                <input matInput formControlName="code" placeholder="FOOTBALL">
                @if (sportForm.controls.code.hasError('required')) {
                  <mat-error>El codigo es obligatorio.</mat-error>
                }
                @if (sportForm.controls.code.hasError('pattern')) {
                  <mat-error>Usa letras, numeros o guion bajo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput formControlName="name">
                @if (sportForm.controls.name.hasError('required')) {
                  <mat-error>El nombre es obligatorio.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Jugadores en campo</mat-label>
                <input matInput type="number" formControlName="maxPlayersOnField">
                @if (sportForm.controls.maxPlayersOnField.hasError('min')) {
                  <mat-error>Debe ser mayor a cero.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Etiqueta de marcador</mat-label>
                <input matInput formControlName="scoreLabel" placeholder="Goles">
              </mat-form-field>
            </div>

            <div class="check-row">
              <mat-checkbox formControlName="teamBased">Deporte por equipos</mat-checkbox>
              <mat-checkbox formControlName="active">Activo</mat-checkbox>
            </div>

            @if (sportValidationMessage()) {
              <p class="validation-message">{{ sportValidationMessage() }}</p>
            }

            <div class="form-actions">
              <button mat-stroked-button type="button" (click)="resetSportForm()">Limpiar</button>
              @if (canManage()) {
                <button mat-flat-button color="primary" type="submit" [disabled]="savingSport()">
                  {{ savingSport() ? 'Guardando...' : editingSport() ? 'Actualizar deporte' : 'Crear deporte' }}
                </button>
              } @else {
                <span class="muted">Tu sesion tiene solo lectura para configuracion.</span>
              }
            </div>
          </form>

          <section class="config-panel">
            <h2>Formatos de competencia</h2>
            @if (formatsLoading()) {
              <app-loading-state label="Cargando formatos..." />
            } @else if (competitionFormats().length === 0) {
              <div class="empty-state">
                <strong>Sin formatos disponibles</strong>
                <p>El backend no devolvio formatos de competencia.</p>
              </div>
            } @else {
              <div class="format-list">
                @for (format of competitionFormats(); track format.code) {
                  <article class="format-item">
                    <strong>{{ format.name }}</strong>
                    <span class="muted">{{ format.code }}</span>
                    <p>{{ format.description }}</p>
                  </article>
                }
              </div>
            }
          </section>
        </div>

        <div class="actions-row">
          <mat-checkbox [checked]="sportsActiveOnly()" (change)="toggleSportsActiveOnly($event.checked)">
            Solo deportes activos
          </mat-checkbox>
          <button mat-stroked-button type="button" (click)="loadSports()">Recargar deportes</button>
        </div>

        @if (sportsLoading()) {
          <app-loading-state label="Cargando deportes..." />
        } @else if (sports().length === 0) {
          <div class="empty-state">
            <strong>No hay deportes para mostrar</strong>
            <p>Crea un deporte o desactiva el filtro de activos para revisar el catalogo completo.</p>
          </div>
        } @else {
          <div class="table-wrapper">
            <table mat-table [dataSource]="sports()" class="w-100">
              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef>Codigo</th>
                <td mat-cell *matCellDef="let sport">{{ sport.code }}</td>
              </ng-container>

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let sport">{{ sport.name }}</td>
              </ng-container>

              <ng-container matColumnDef="teamBased">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let sport">{{ sport.teamBased ? 'Equipos' : 'Individual' }}</td>
              </ng-container>

              <ng-container matColumnDef="maxPlayersOnField">
                <th mat-header-cell *matHeaderCellDef>En campo</th>
                <td mat-cell *matCellDef="let sport">{{ sport.maxPlayersOnField || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="scoreLabel">
                <th mat-header-cell *matHeaderCellDef>Marcador</th>
                <td mat-cell *matCellDef="let sport">{{ sport.scoreLabel || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="active">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let sport">
                  <span class="chip-status" [class.active]="sport.active" [class.inactive]="!sport.active">
                    {{ sport.active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let sport">
                  <button mat-button type="button" (click)="selectSport(sport)">
                    Posiciones
                  </button>
                  @if (canManage()) {
                    <button mat-button type="button" (click)="editSport(sport)">Editar</button>
                    <button mat-button color="warn" type="button" (click)="removeSport(sport)">Eliminar</button>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="sportColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: sportColumns"></tr>
            </table>
          </div>
        }
      </section>

      <section class="card page-card app-page">
        @if (!selectedSport()) {
          <div class="empty-state">
            <strong>Selecciona un deporte</strong>
            <p>Las posiciones se administran dentro del deporte seleccionado.</p>
          </div>
        } @else {
          <app-page-header
            [title]="'Posiciones de ' + selectedSport()?.name"
            subtitle="Catalogo hijo conectado a /sports/{sportId}/positions."
          />

          <form [formGroup]="positionForm" (ngSubmit)="savePosition()" class="config-panel">
            <h2>{{ editingPosition() ? 'Editar posicion' : 'Nueva posicion' }}</h2>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Codigo</mat-label>
                <input matInput formControlName="code" placeholder="GK">
                @if (positionForm.controls.code.hasError('required')) {
                  <mat-error>El codigo es obligatorio.</mat-error>
                }
                @if (positionForm.controls.code.hasError('pattern')) {
                  <mat-error>Usa letras, numeros o guion bajo.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput formControlName="name">
                @if (positionForm.controls.name.hasError('required')) {
                  <mat-error>El nombre es obligatorio.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Orden</mat-label>
                <input matInput type="number" formControlName="displayOrder">
                @if (positionForm.controls.displayOrder.hasError('min')) {
                  <mat-error>Debe ser mayor a cero.</mat-error>
                }
              </mat-form-field>
            </div>

            <mat-checkbox formControlName="active">Activa</mat-checkbox>

            @if (positionValidationMessage()) {
              <p class="validation-message">{{ positionValidationMessage() }}</p>
            }

            <div class="form-actions">
              <button mat-stroked-button type="button" (click)="resetPositionForm()">Limpiar</button>
              @if (canManage()) {
                <button mat-flat-button color="primary" type="submit" [disabled]="savingPosition()">
                  {{ savingPosition() ? 'Guardando...' : editingPosition() ? 'Actualizar posicion' : 'Crear posicion' }}
                </button>
              }
            </div>
          </form>

          <div class="actions-row">
            <mat-checkbox [checked]="positionsActiveOnly()" (change)="togglePositionsActiveOnly($event.checked)">
              Solo posiciones activas
            </mat-checkbox>
            <button mat-stroked-button type="button" (click)="loadPositions()">Recargar posiciones</button>
          </div>

          @if (positionsLoading()) {
            <app-loading-state label="Cargando posiciones..." />
          } @else if (positions().length === 0) {
            <div class="empty-state">
              <strong>Sin posiciones configuradas</strong>
              <p>Crea posiciones para este deporte o desactiva el filtro de activas.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table mat-table [dataSource]="positions()" class="w-100">
                <ng-container matColumnDef="displayOrder">
                  <th mat-header-cell *matHeaderCellDef>Orden</th>
                  <td mat-cell *matCellDef="let position">{{ position.displayOrder }}</td>
                </ng-container>

                <ng-container matColumnDef="code">
                  <th mat-header-cell *matHeaderCellDef>Codigo</th>
                  <td mat-cell *matCellDef="let position">{{ position.code }}</td>
                </ng-container>

                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Nombre</th>
                  <td mat-cell *matCellDef="let position">{{ position.name }}</td>
                </ng-container>

                <ng-container matColumnDef="active">
                  <th mat-header-cell *matHeaderCellDef>Estado</th>
                  <td mat-cell *matCellDef="let position">
                    <span class="chip-status" [class.active]="position.active" [class.inactive]="!position.active">
                      {{ position.active ? 'Activa' : 'Inactiva' }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let position">
                    @if (canManage()) {
                      <button mat-button type="button" (click)="editPosition(position)">Editar</button>
                      <button mat-button color="warn" type="button" (click)="removePosition(position)">Eliminar</button>
                    }
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="positionColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: positionColumns"></tr>
              </table>
            </div>
          }
        }
      </section>
    </section>
  `,
  styles: [
    `
      .settings-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
      }

      .config-panel {
        display: grid;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .config-panel h2 {
        margin: 0;
        font-size: 1.05rem;
      }

      .check-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .format-list {
        display: grid;
        gap: 0.75rem;
      }

      .format-item {
        display: grid;
        gap: 0.25rem;
        padding: 0.85rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
      }

      .format-item p {
        margin: 0;
      }

      .validation-message {
        margin: 0;
        color: var(--danger);
        font-weight: 600;
      }

      @media (max-width: 900px) {
        .settings-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SportsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sportsService = inject(SportsService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);
  private readonly authorization = inject(AuthorizationService);

  protected readonly sportsLoading = signal(true);
  protected readonly positionsLoading = signal(false);
  protected readonly formatsLoading = signal(true);
  protected readonly savingSport = signal(false);
  protected readonly savingPosition = signal(false);
  protected readonly sportsActiveOnly = signal(true);
  protected readonly positionsActiveOnly = signal(true);
  protected readonly sports = signal<Sport[]>([]);
  protected readonly positions = signal<SportPosition[]>([]);
  protected readonly competitionFormats = signal<CompetitionFormat[]>([]);
  protected readonly selectedSport = signal<Sport | null>(null);
  protected readonly editingSport = signal<Sport | null>(null);
  protected readonly editingPosition = signal<SportPosition | null>(null);
  protected readonly sportValidationMessage = signal('');
  protected readonly positionValidationMessage = signal('');
  protected readonly canManage = computed(() => this.authorization.canManage('configuration:basic'));
  protected readonly sportColumns = [
    'code',
    'name',
    'teamBased',
    'maxPlayersOnField',
    'scoreLabel',
    'active',
    'actions'
  ];
  protected readonly positionColumns = ['displayOrder', 'code', 'name', 'active', 'actions'];

  protected readonly sportForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/^[A-Za-z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    teamBased: [true],
    maxPlayersOnField: this.fb.control<number | null>(null, [Validators.min(1)]),
    scoreLabel: ['', Validators.maxLength(30)],
    active: [true]
  });

  protected readonly positionForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/^[A-Za-z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    displayOrder: [1, [Validators.required, Validators.min(1)]],
    active: [true]
  });

  constructor() {
    this.loadSports();
    this.loadCompetitionFormats();
  }

  protected loadSports(): void {
    this.sportsLoading.set(true);
    this.sportsService
      .list(this.sportsActiveOnly())
      .pipe(finalize(() => this.sportsLoading.set(false)))
      .subscribe({
        next: (sports) => {
          this.sports.set(sports);
          const selected = this.selectedSport();
          if (selected && !sports.some((sport) => sport.id === selected.id)) {
            this.selectedSport.set(null);
            this.positions.set([]);
          }
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected loadCompetitionFormats(): void {
    this.formatsLoading.set(true);
    this.sportsService
      .listCompetitionFormats()
      .pipe(finalize(() => this.formatsLoading.set(false)))
      .subscribe({
        next: (formats) => this.competitionFormats.set(formats),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected toggleSportsActiveOnly(activeOnly: boolean): void {
    this.sportsActiveOnly.set(activeOnly);
    this.loadSports();
  }

  protected selectSport(sport: Sport): void {
    this.selectedSport.set(sport);
    this.resetPositionForm();
    this.loadPositions();
  }

  protected loadPositions(): void {
    const sport = this.selectedSport();
    if (!sport) {
      return;
    }

    this.positionsLoading.set(true);
    this.sportsService
      .listPositions(sport.id, this.positionsActiveOnly())
      .pipe(finalize(() => this.positionsLoading.set(false)))
      .subscribe({
        next: (positions) => this.positions.set(positions),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected togglePositionsActiveOnly(activeOnly: boolean): void {
    this.positionsActiveOnly.set(activeOnly);
    this.loadPositions();
  }

  protected editSport(sport: Sport): void {
    this.editingSport.set(sport);
    this.sportValidationMessage.set('');
    this.sportForm.setValue({
      code: sport.code,
      name: sport.name,
      teamBased: sport.teamBased,
      maxPlayersOnField: sport.maxPlayersOnField,
      scoreLabel: sport.scoreLabel ?? '',
      active: sport.active
    });
  }

  protected resetSportForm(): void {
    this.editingSport.set(null);
    this.sportValidationMessage.set('');
    this.sportForm.setValue({
      code: '',
      name: '',
      teamBased: true,
      maxPlayersOnField: null,
      scoreLabel: '',
      active: true
    });
  }

  protected saveSport(): void {
    if (!this.canManage() || this.savingSport()) {
      return;
    }

    if (this.sportForm.invalid) {
      this.sportForm.markAllAsTouched();
      this.sportValidationMessage.set('Revisa los campos obligatorios antes de guardar.');
      return;
    }

    const value = this.sportForm.getRawValue();
    const payload = {
      code: value.code.trim().toUpperCase(),
      name: value.name.trim(),
      teamBased: value.teamBased,
      maxPlayersOnField: value.maxPlayersOnField,
      scoreLabel: value.scoreLabel.trim(),
      active: value.active
    };

    this.savingSport.set(true);
    const editing = this.editingSport();
    const request$ = editing
      ? this.sportsService.update(editing.id, payload)
      : this.sportsService.create(payload);

    request$.pipe(finalize(() => this.savingSport.set(false))).subscribe({
      next: (sport) => {
        this.notifications.success('Deporte guardado correctamente');
        this.resetSportForm();
        this.loadSports();
        if (this.selectedSport()?.id === sport.id) {
          this.selectedSport.set(sport);
        }
      },
      error: (error: unknown) => {
        this.sportValidationMessage.set(this.errorMapper.map(error).message);
        this.notifications.error(this.sportValidationMessage());
      }
    });
  }

  protected removeSport(sport: Sport): void {
    if (!this.canManage()) {
      return;
    }

    if (!window.confirm(`Se eliminara el deporte "${sport.name}" si no tiene torneos ni posiciones asociadas.`)) {
      return;
    }

    this.sportsLoading.set(true);
    this.sportsService
      .delete(sport.id)
      .pipe(finalize(() => this.sportsLoading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Deporte eliminado correctamente');
          if (this.selectedSport()?.id === sport.id) {
            this.selectedSport.set(null);
            this.positions.set([]);
          }
          this.loadSports();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected editPosition(position: SportPosition): void {
    this.editingPosition.set(position);
    this.positionValidationMessage.set('');
    this.positionForm.setValue({
      code: position.code,
      name: position.name,
      displayOrder: position.displayOrder,
      active: position.active
    });
  }

  protected resetPositionForm(): void {
    this.editingPosition.set(null);
    this.positionValidationMessage.set('');
    this.positionForm.setValue({
      code: '',
      name: '',
      displayOrder: 1,
      active: true
    });
  }

  protected savePosition(): void {
    const sport = this.selectedSport();
    if (!sport || !this.canManage() || this.savingPosition()) {
      return;
    }

    if (this.positionForm.invalid) {
      this.positionForm.markAllAsTouched();
      this.positionValidationMessage.set('Revisa los campos obligatorios antes de guardar.');
      return;
    }

    const value = this.positionForm.getRawValue();
    const payload = {
      code: value.code.trim().toUpperCase(),
      name: value.name.trim(),
      displayOrder: value.displayOrder,
      active: value.active
    };

    this.savingPosition.set(true);
    const editing = this.editingPosition();
    const request$ = editing
      ? this.sportsService.updatePosition(sport.id, editing.id, payload)
      : this.sportsService.createPosition(sport.id, payload);

    request$.pipe(finalize(() => this.savingPosition.set(false))).subscribe({
      next: () => {
        this.notifications.success('Posicion guardada correctamente');
        this.resetPositionForm();
        this.loadPositions();
      },
      error: (error: unknown) => {
        this.positionValidationMessage.set(this.errorMapper.map(error).message);
        this.notifications.error(this.positionValidationMessage());
      }
    });
  }

  protected removePosition(position: SportPosition): void {
    const sport = this.selectedSport();
    if (!sport || !this.canManage()) {
      return;
    }

    if (!window.confirm(`Se eliminara la posicion "${position.name}" del deporte "${sport.name}".`)) {
      return;
    }

    this.positionsLoading.set(true);
    this.sportsService
      .deletePosition(sport.id, position.id)
      .pipe(finalize(() => this.positionsLoading.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Posicion eliminada correctamente');
          this.loadPositions();
        },
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }
}
