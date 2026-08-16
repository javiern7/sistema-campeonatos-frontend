import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AuthorizationResource, AuthorizationService } from '../../core/auth/authorization.service';
import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import {
  ManagedPermission,
  ManagedRolePermission,
  OperationalActivitySummary,
  OperationalAuditEvent,
  OperationalAuditResult,
  PermissionGovernanceSummary
} from '../operations/operations.models';
import { OperationsService } from '../operations/operations.service';
import { TournamentStatus } from '../tournaments/tournament.models';
import {
  DashboardAlert,
  DashboardHealth,
  DashboardSportSummary,
  DashboardSummary,
  DashboardTournamentSummary
} from './dashboard.models';
import { DashboardService } from './dashboard.service';

type DashboardCard = {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
};

type DashboardAction = {
  label: string;
  description: string;
  cta: string;
  path: string;
  queryParams: Record<string, string | number>;
  resource?: AuthorizationResource;
  action?: 'read' | 'manage';
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, PageHeaderComponent, LoadingStateComponent],
  template: `
    <section class="app-page">
      <app-page-header
        title="Inicio"
        subtitle="Resumen general de campeonatos, participantes, partidos y alertas importantes."
      />

      @if (loading()) {
        <app-loading-state />
      } @else if (summaryError()) {
        <div class="empty-state error-state" role="alert">
          <strong>No se pudo cargar el dashboard.</strong>
          <p class="muted">{{ summaryError() }}</p>
          <button mat-stroked-button type="button" (click)="loadSummary()">Reintentar</button>
        </div>
      } @else {
        <div class="context-banner">
          <strong>Centro de control</strong>
          <span class="muted">{{ healthMessage() }}</span>
        </div>

        <section class="control-hero card">
          <div class="control-copy">
            <span class="section-badge">Hoy en tus campeonatos</span>
            <h2>{{ controlHeadline() }}</h2>
            <p class="muted">{{ controlMessage() }}</p>
          </div>

          <div class="control-metrics">
            @for (card of controlCards(); track card.label) {
              <article class="control-metric" [class.accent]="card.accent">
                <span class="summary-label">{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
                <span class="summary-meta">{{ card.meta }}</span>
              </article>
            }
          </div>
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Acciones principales</h2>
              <p class="muted">Atajos para operar campeonatos sin buscar modulos manualmente.</p>
            </div>
          </div>

          <div class="dashboard-actions-grid">
            @for (action of primaryActions(); track action.label) {
              <article class="dashboard-action-card">
                <strong>{{ action.label }}</strong>
                <p class="muted">{{ action.description }}</p>
                <a mat-button [routerLink]="action.path" [queryParams]="action.queryParams">{{ action.cta }}</a>
              </article>
            }
          </div>
        </section>

        <div class="executive-grid">
          @for (card of executiveCards(); track card.label) {
            <article class="executive-card card" [class.accent]="card.accent">
              <span class="summary-label">{{ card.label }}</span>
              <strong class="executive-value">{{ card.value }}</strong>
              <span class="summary-meta">{{ card.meta }}</span>
            </article>
          }
        </div>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Campeonatos para operar ahora</h2>
              <p class="muted">Entradas directas al hub guiado del campeonato y su siguiente paso recomendado.</p>
            </div>
            <span class="section-badge">{{ highlightedTournaments().length }} destacados</span>
          </div>

          @if (highlightedTournaments().length === 0) {
            <div class="empty-state">
              <strong>No hay campeonatos activos para operar.</strong>
              <p class="muted">Crea o abre un campeonato para iniciar el flujo guiado.</p>
              @if (canManageTournaments()) {
                <a mat-flat-button color="primary" routerLink="/tournaments/new">Crear campeonato</a>
              }
            </div>
          } @else {
            <div class="featured-tournament-grid">
              @for (tournament of highlightedTournaments(); track tournament.tournamentId) {
                <article class="featured-tournament-card card">
                  <div class="alert-header">
                    <div class="stack-sm">
                      <strong>{{ tournament.tournamentName }}</strong>
                      <span class="muted">{{ tournament.sportName }} / {{ statusLabel(tournament.status) }}</span>
                    </div>
                    <span class="health-pill" [class]="healthClass(tournament.health)">{{ healthLabel(tournament.health) }}</span>
                  </div>

                  <div class="progress-metrics">
                    <div>
                      <span class="progress-label">Avance</span>
                      <strong>{{ tournament.readinessScore }}%</strong>
                    </div>
                    <div>
                      <span class="progress-label">Partidos</span>
                      <strong>{{ tournament.playedMatchCount }}/{{ tournament.matchCount }}</strong>
                    </div>
                    <div>
                      <span class="progress-label">Tabla</span>
                      <strong>{{ tournament.standingsCount }}</strong>
                    </div>
                  </div>

                  <p class="muted">{{ tournament.nextAction }}</p>

                  <div class="card-actions">
                    <a mat-flat-button color="primary" [routerLink]="['/tournaments', tournament.tournamentId]">Gestionar campeonato</a>
                    @if (tournament.playedMatchCount > 0) {
                      <a mat-button routerLink="/standings" [queryParams]="{ tournamentId: tournament.tournamentId }">Ver tabla</a>
                    } @else {
                      <a mat-button routerLink="/matches" [queryParams]="{ tournamentId: tournament.tournamentId }">Ver partidos</a>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>

        @if (operationsVisible()) {
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
              <h2>Administracion avanzada</h2>
                <p class="muted">Auditoria, actividad reciente y permisos para seguimiento interno.</p>
              </div>
              <span class="section-badge">Avanzado</span>
            </div>

            @if (operationsLoading()) {
          <app-loading-state label="Cargando actividad reciente..." />
            } @else {
              <div class="operations-grid">
                <article class="operations-panel card">
                  <div class="panel-heading">
                    <h3>Resumen de actividad</h3>
                    <span class="muted">Ultimos movimientos</span>
                  </div>

                  @if (activitySummaryError()) {
                    <div class="empty-state compact">
                      <strong>No se pudo cargar el resumen de actividad.</strong>
                      <p class="muted">{{ activitySummaryError() }}</p>
                    </div>
                  } @else {
                    <div class="summary-grid">
                      @for (card of auditCards(); track card.label) {
                        <mat-card class="summary-card card" [class.accent]="card.accent">
                          <span class="summary-label">{{ card.label }}</span>
                          <span class="summary-value">{{ card.value }}</span>
                          <span class="summary-meta">{{ card.meta }}</span>
                        </mat-card>
                      }
                    </div>
                  }
                </article>

                <article class="operations-panel card">
                  <div class="panel-heading">
                    <h3>Ultimos eventos</h3>
                    <span class="muted">Eventos recientes</span>
                  </div>

                  @if (recentAuditEventsError()) {
                    <div class="empty-state compact">
                      <strong>No se pudo cargar la actividad reciente.</strong>
                      <p class="muted">{{ recentAuditEventsError() }}</p>
                    </div>
                  } @else if (recentAuditEvents().length === 0) {
                    <div class="empty-state compact">
                      <strong>No hay actividad reciente.</strong>
                      <p class="muted">No hay eventos recientes dentro de la ventana actual.</p>
                    </div>
                  } @else {
                    <div class="event-list">
                      @for (event of recentAuditEvents(); track event.id) {
                        <article class="event-item">
                          <div class="alert-header">
                            <div class="stack-sm">
                              <strong>{{ actionLabel(event.action) }}</strong>
                              <span class="muted">
                                {{ event.actorUsername || 'Sistema' }} / {{ entityLabel(event) }} / {{ formatOccurredAt(event.occurredAt) }}
                              </span>
                            </div>
                            <span class="health-pill" [class]="resultClass(event.result)">{{ resultLabel(event.result) }}</span>
                          </div>
                          <p class="muted">{{ eventDetail(event) }}</p>
                          @if (contextLine(event)) {
                            <span class="event-context">{{ contextLine(event) }}</span>
                          }
                        </article>
                      }
                    </div>
                  }
                </article>

                <article class="operations-panel card">
                  <div class="panel-heading">
                    <h3>Acciones mas frecuentes</h3>
                    <span class="muted">Actividad destacada</span>
                  </div>

                  @if (activitySummaryError()) {
                    <div class="empty-state compact">
                      <strong>No se pudo cargar el ranking de acciones.</strong>
                      <p class="muted">{{ activitySummaryError() }}</p>
                    </div>
                  } @else if (topActions().length === 0) {
                    <div class="empty-state compact">
                      <strong>No hay acciones frecuentes para resumir.</strong>
                      <p class="muted">No hay suficiente actividad para mostrar un ranking.</p>
                    </div>
                  } @else {
                    <div class="top-actions">
                      @for (item of topActions(); track item.action) {
                        <article class="top-action-item">
                          <div class="stack-sm">
                            <strong>{{ actionLabel(item.action) }}</strong>
                            <span class="muted">{{ actionCategoryLabel(item.action) }}</span>
                          </div>
                          <span class="top-action-total">{{ item.total }}</span>
                        </article>
                      }
                    </div>
                  }
                </article>
              </div>

              <div class="governance-shell">
                <div class="section-heading">
                  <div>
                    <h2>Administracion de permisos</h2>
                    <p class="muted">
                      Control de acceso para usuarios y roles administrativos.
                    </p>
                  </div>
                  <span class="section-badge">
                    {{ canManageGovernance() ? 'Edicion habilitada' : 'Solo lectura' }}
                  </span>
                </div>

                @if (governanceError()) {
                  <div class="empty-state compact">
                    <strong>No se pudo cargar el resumen de permisos.</strong>
                    <p class="muted">{{ governanceError() }}</p>
                  </div>
                } @else if (!governanceSummary()) {
                  <div class="empty-state compact">
                    <strong>No hay resumen de permisos disponible.</strong>
                    <p class="muted">No hay informacion de roles y permisos disponible.</p>
                  </div>
                } @else {
                  <div class="summary-grid">
                    @for (card of governanceCards(); track card.label) {
                      <mat-card class="summary-card card" [class.accent]="card.accent">
                        <span class="summary-label">{{ card.label }}</span>
                        <span class="summary-value">{{ card.value }}</span>
                        <span class="summary-meta">{{ card.meta }}</span>
                      </mat-card>
                    }
                  </div>

                  <div class="governance-banner" [class.warning]="!governanceWriteEnabled()">
                    <strong>{{ governanceWriteEnabled() ? 'Edicion habilitada' : 'Edicion no disponible' }}</strong>
                    <span class="muted">
                      Generado {{ formatOccurredAt(governanceSummary()!.generatedAt) }}.
                      Roles editables: {{ mutableRoleCodes().length || 'ninguno' }}.
                    </span>
                  </div>

                  <div class="governance-grid">
                    <article class="operations-panel card">
                      <div class="panel-heading">
                        <h3>Roles gobernables</h3>
                        <span class="muted">{{ governanceRoles().length }} roles</span>
                      </div>

                      <div class="role-list">
                        @for (role of governanceRoles(); track role.roleCode) {
                          <article class="role-card" [class.editing]="editingRoleCode() === role.roleCode">
                            <div class="alert-header">
                              <div class="stack-sm">
                                <strong>{{ role.roleName }}</strong>
                                <span class="muted">{{ roleLabel(role) }}</span>
                              </div>
                              <span class="health-pill" [class]="role.mutable ? 'healthy' : 'warning'">
                                {{ role.mutable ? 'Editable' : 'Protegido' }}
                              </span>
                            </div>

                            <div class="permission-chip-list">
                              @for (permissionCode of role.permissionCodes; track permissionCode) {
                                <span class="permission-chip">{{ permissionLabel(permissionCode) }}</span>
                              }
                            </div>

                            @if (canManageGovernance() && role.mutable) {
                              <div class="card-actions">
                                @if (editingRoleCode() === role.roleCode) {
                                  <button mat-button type="button" (click)="cancelGovernanceEdit()">Cancelar</button>
                                } @else {
                                  <button mat-button type="button" (click)="startGovernanceEdit(role)">Editar permisos</button>
                                }
                              </div>
                            }
                          </article>
                        }
                      </div>
                    </article>

                    <article class="operations-panel card">
                      <div class="panel-heading">
                        <h3>Editor controlado</h3>
                      <span class="muted">Actualizacion de roles</span>
                      </div>

                      @if (!canManageGovernance()) {
                        <div class="empty-state compact">
                          <strong>La sesion actual no puede editar asignaciones.</strong>
                          <p class="muted">Tu usuario no tiene acceso para actualizar permisos por rol.</p>
                        </div>
                      } @else if (!governanceWriteEnabled()) {
                        <div class="empty-state compact">
                          <strong>La escritura esta cerrada en este ambiente.</strong>
                          <p class="muted">La edicion de permisos no esta disponible en este ambiente.</p>
                        </div>
                      } @else if (!editingRole()) {
                        <div class="empty-state compact">
                          <strong>Seleccionar un rol mutable.</strong>
                          <p class="muted">Selecciona un rol disponible para actualizar sus permisos.</p>
                        </div>
                      } @else {
                        <div class="editor-shell">
                          <div class="stack-sm">
                            <strong>{{ editingRole()!.roleName }}</strong>
                            <span class="muted">{{ roleLabel(editingRole()!) }}</span>
                          </div>

                          <label class="reason-field">
                            <span>Motivo del cambio</span>
                            <textarea
                              rows="3"
                              [value]="governanceReason()"
                              (input)="updateGovernanceReason($event)"
                              placeholder="Ejemplo: ajustar el alcance del rol para el equipo administrativo"
                            ></textarea>
                          </label>

                          <div class="permission-editor-list">
                            @for (permission of availableGovernancePermissions(); track permission.code) {
                              <label class="permission-option">
                                <input
                                  type="checkbox"
                                  [checked]="isGovernancePermissionSelected(permission.code)"
                                  (change)="toggleGovernancePermission(permission.code)"
                                />
                                <div class="stack-sm">
                                  <strong>{{ permissionLabel(permission.code) }}</strong>
                                  <span class="muted">{{ permission.name }}</span>
                                  @if (permission.description) {
                                    <span class="muted">{{ permission.description }}</span>
                                  }
                                </div>
                              </label>
                            }
                          </div>

                          @if (governanceSaveError()) {
                            <p class="muted governance-error">{{ governanceSaveError() }}</p>
                          }

                          <div class="card-actions">
                            <button mat-button type="button" (click)="cancelGovernanceEdit()">Cancelar</button>
                            <button
                              mat-button
                              type="button"
                              [disabled]="!canSubmitGovernanceEdit() || governanceSaving()"
                              (click)="saveGovernanceEdit()"
                            >
                              {{ governanceSaving() ? 'Guardando...' : 'Guardar permisos' }}
                            </button>
                          </div>
                        </div>
                      }
                    </article>
                  </div>
                }
              </div>
            }
          </section>
        }

        @if (priorityAlerts().length > 0) {
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Prioridad inmediata</h2>
                <p class="muted">Resumen de los puntos que requieren atencion para mantener la competencia al dia.</p>
              </div>
              <span class="section-badge">{{ priorityAlerts().length }} en foco</span>
            </div>

            <div class="priority-list">
              @for (alert of priorityAlerts(); track alert.tournamentId) {
                <article class="priority-item">
                  <div class="priority-rank">{{ $index + 1 }}</div>
                  <div class="stack-sm">
                    <div class="alert-header">
                      <strong>{{ alert.title }}</strong>
                      <span class="health-pill" [class]="healthClass(alert.health)">{{ alertTypeLabel(alert.type) }}</span>
                    </div>
                    <span class="muted">{{ alert.sportName }}</span>
                    <p class="muted">{{ alert.detail }}</p>
                  </div>
                  <div class="card-actions">
                    <a mat-button [routerLink]="alert.actionPath" [queryParams]="alert.actionQueryParams">{{ alert.actionLabel }}</a>
                    <a mat-button [routerLink]="['/tournaments', alert.tournamentId]">Gestionar campeonato</a>
                  </div>
                </article>
              }
            </div>
          </section>
        }

        <div class="summary-grid">
          @for (card of overviewCards(); track card.label) {
            <mat-card class="summary-card card" [class.accent]="card.accent">
              <span class="summary-label">{{ card.label }}</span>
              <span class="summary-value">{{ card.value }}</span>
              <span class="summary-meta">{{ card.meta }}</span>
            </mat-card>
          }
        </div>

        <div class="summary-grid">
          @for (card of operationCards(); track card.label) {
            <mat-card class="summary-card card">
              <span class="summary-label">{{ card.label }}</span>
              <span class="summary-value">{{ card.value }}</span>
              <span class="summary-meta">{{ card.meta }}</span>
            </mat-card>
          }
        </div>

        <div class="summary-grid">
          @for (card of alertTypeCards(); track card.label) {
            <mat-card class="summary-card card" [class.accent]="card.accent">
              <span class="summary-label">{{ card.label }}</span>
              <span class="summary-value">{{ card.value }}</span>
              <span class="summary-meta">{{ card.meta }}</span>
            </mat-card>
          }
        </div>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Seguimiento de campeonatos</h2>
              <p class="muted">Lectura del flujo inscripciones -> planteles -> partidos -> tabla en campeonatos con actividad.</p>
            </div>
            <span class="section-badge">{{ operationalSummaries().length }} en foco</span>
          </div>

          @if (operationalSummaries().length === 0) {
            <div class="empty-state">
              <strong>No hay campeonatos activos para revisar.</strong>
              <p class="muted">El foco actual esta en configurar la base o revisar borradores.</p>
            </div>
          } @else {
            <div class="tournament-grid">
              @for (tournament of operationalSummaries(); track tournament.tournamentId) {
                <article class="tournament-card card">
                  <div class="alert-header">
                    <div class="stack-sm">
                      <strong>{{ tournament.tournamentName }}</strong>
                      <span class="muted">{{ tournament.sportName }} / {{ statusLabel(tournament.status) }}</span>
                    </div>
                    <span class="health-pill" [class]="healthClass(tournament.health)">{{ auditLabel(tournament.auditStatus) }}</span>
                  </div>

                  <div class="progress-metrics">
                    <div>
                      <span class="progress-label">Avance del campeonato</span>
                      <strong>{{ tournament.readinessScore }}%</strong>
                    </div>
                    <div>
                      <span class="progress-label">Cobertura de plantel</span>
                      <strong>{{ tournament.registrationsWithActiveRosterCount }}/{{ tournament.approvedRegistrationCount }}</strong>
                    </div>
                    <div>
                      <span class="progress-label">Cobertura de tabla</span>
                      <strong>{{ tournament.standingsCoverageCount }}/{{ tournament.approvedRegistrationCount }}</strong>
                    </div>
                  </div>

                  <div class="mini-metrics">
                    <span>Inscripciones aprobadas: {{ tournament.approvedRegistrationCount }}</span>
                    <span>Sin plantel activo: {{ tournament.rosterGapCount }}</span>
                    <span>Partidos jugados: {{ tournament.playedMatchCount }}/{{ tournament.matchCount }}</span>
                    <span>Tabla: {{ tournament.standingsCount }}</span>
                  </div>

                  <p class="muted">{{ tournament.auditMessage }}</p>

                  @if (tournament.blockers.length > 0) {
                    <div class="blocker-list">
                      @for (blocker of tournament.blockers; track blocker) {
                        <span class="blocker-chip">{{ blocker }}</span>
                      }
                    </div>
                  }

                  <p class="muted">{{ tournament.nextAction }}</p>

                  <div class="card-actions">
                    <a mat-button [routerLink]="['/tournaments', tournament.tournamentId]">Gestionar campeonato</a>
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Alertas prioritarias</h2>
              <p class="muted">Campeonatos que conviene atender primero para no perder continuidad.</p>
            </div>
            <span class="section-badge">{{ alerts().length }} abiertas</span>
          </div>

          @if (alerts().length === 0) {
            <div class="empty-state">
              <strong>No hay alertas prioritarias.</strong>
              <p class="muted">La cartera actual mantiene trazabilidad visible en los torneos cargados.</p>
            </div>
          } @else {
            <div class="alert-grid">
              @for (alert of alerts(); track alert.tournamentId) {
                <article class="alert-card card">
                  <div class="alert-header">
                    <span class="health-pill" [class]="healthClass(alert.health)">{{ healthLabel(alert.health) }}</span>
                    <span class="muted">{{ alert.sportName }}</span>
                  </div>
                  <strong>{{ alert.title }}</strong>
                  <span class="alert-type">{{ alertTypeLabel(alert.type) }}</span>
                  <p class="muted">{{ alert.detail }}</p>
                  <div class="card-actions">
                    <a mat-button [routerLink]="alert.actionPath" [queryParams]="alert.actionQueryParams">{{ alert.actionLabel }}</a>
                    <a mat-button [routerLink]="['/tournaments', alert.tournamentId]">Gestionar campeonato</a>
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Radar por deporte</h2>
              <p class="muted">Lectura ejecutiva para detectar donde ya hay operacion madura y donde aun falta cerrar el flujo.</p>
            </div>
          </div>

          <div class="sport-grid">
            @for (sport of sportSummaries(); track sport.sportId) {
              <article class="sport-card card">
                <div class="alert-header">
                  <strong>{{ sport.sportName }}</strong>
                  <span class="health-pill" [class]="healthClass(sport.health)">{{ healthLabel(sport.health) }}</span>
                </div>
                <p class="muted">{{ sport.healthMessage }}</p>
                <div class="mini-metrics">
                  <span>Torneos: {{ sport.tournamentCount }}</span>
                  <span>En curso: {{ sport.liveTournamentCount }}</span>
                  <span>Inscripciones aprobadas: {{ sport.approvedRegistrationCount }}</span>
                  <span>Planteles activos: {{ sport.activeRosterCount }}</span>
                  <span>Partidos jugados: {{ sport.playedMatchCount }}/{{ sport.matchCount }}</span>
                  <span>Tablas: {{ sport.standingsCount }}</span>
                </div>
              </article>
            }
          </div>
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Seguimiento por torneo</h2>
              <p class="muted">Pendientes visibles para decidir el siguiente bloque de trabajo.</p>
            </div>
            <span class="section-badge">{{ tournamentSummaries().length }} torneos</span>
          </div>

          @if (tournamentSummaries().length === 0) {
            <div class="empty-state">
              <strong>No hay torneos registrados.</strong>
              <p class="muted">Crear un torneo sigue siendo el punto de arranque para activar la capa multideporte.</p>
            </div>
          } @else {
            <div class="tournament-grid">
              @for (tournament of tournamentSummaries(); track tournament.tournamentId) {
                <article class="tournament-card card">
                  <div class="alert-header">
                    <div class="stack-sm">
                      <strong>{{ tournament.tournamentName }}</strong>
                      <span class="muted">{{ tournament.sportName }} / {{ statusLabel(tournament.status) }} / {{ segmentLabel(tournament.reportingSegment) }}</span>
                    </div>
                    <span class="health-pill" [class]="healthClass(tournament.health)">{{ healthLabel(tournament.health) }}</span>
                  </div>

                  <div class="mini-metrics">
                    <span>Etapas: {{ tournament.stageCount }}</span>
                    <span>Grupos: {{ tournament.groupCount }}</span>
                    <span>Inscripciones: {{ tournament.registrationCount }}</span>
                    <span>Con plantel: {{ tournament.registrationsWithActiveRosterCount }}/{{ tournament.approvedRegistrationCount }}</span>
                    <span>Planteles activos: {{ tournament.activeRosterCount }}</span>
                    <span>Partidos: {{ tournament.playedMatchCount }}/{{ tournament.matchCount }} jugados</span>
                    <span>Incidencias: {{ tournament.incidentMatchCount }}</span>
                    <span>Tabla: {{ tournament.standingsCount }}</span>
                    <span>Lider: {{ leaderLabel(tournament) }}</span>
                  </div>

                  <p class="muted">{{ tournament.nextAction }}</p>

                  <div class="card-actions">
                    <a mat-button [routerLink]="['/tournaments', tournament.tournamentId]">Gestionar campeonato</a>
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Borradores y pruebas</h2>
              <p class="muted">Torneos que hoy conviene mantener fuera del resumen ejecutivo principal para reducir ruido.</p>
            </div>
            <span class="section-badge">{{ sandboxSummaries().length }} separados</span>
          </div>

          @if (sandboxSummaries().length === 0) {
            <div class="empty-state">
              <strong>No hay campeonatos de prueba o borrador fuera del foco principal.</strong>
              <p class="muted">El resumen actual se apoya solo en campeonatos activos.</p>
            </div>
          } @else {
            <div class="alert-grid">
              @for (tournament of sandboxSummaries(); track tournament.tournamentId) {
                <article class="alert-card card">
                  <div class="alert-header">
                    <strong>{{ tournament.tournamentName }}</strong>
                    <span class="health-pill warning">{{ segmentLabel(tournament.reportingSegment) }}</span>
                  </div>
                  <p class="muted">{{ tournament.auditMessage }}</p>
                  <p class="muted">{{ tournament.nextAction }}</p>
                  <div class="card-actions">
                    <a mat-button [routerLink]="['/tournaments', tournament.tournamentId]">Gestionar campeonato</a>
                  </div>
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
      .section-heading {
        display: flex;
        gap: 1rem;
        align-items: start;
        justify-content: space-between;
      }

      .section-heading h2 {
        margin: 0;
        font-size: 1.1rem;
      }

      .section-heading p {
        margin: 0.35rem 0 0;
      }

      .section-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.4rem 0.75rem;
        border-radius: 999px;
        background: var(--primary-soft);
        color: var(--primary-strong);
        font-size: 0.85rem;
        font-weight: 800;
      }

      .control-hero {
        display: grid;
        gap: 1.25rem;
        grid-template-columns: minmax(0, 1.2fr) minmax(320px, 1.8fr);
        padding: 1.25rem;
        border-left: 4px solid var(--primary);
      }

      .control-copy {
        display: grid;
        align-content: center;
        gap: 0.65rem;
      }

      .control-copy h2 {
        margin: 0;
        font-size: 1.65rem;
      }

      .control-copy p {
        margin: 0;
      }

      .control-copy .section-badge {
        width: fit-content;
      }

      .control-metrics,
      .dashboard-actions-grid,
      .featured-tournament-grid {
        display: grid;
        gap: 1rem;
      }

      .control-metrics {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }

      .control-metric {
        display: grid;
        gap: 0.35rem;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .control-metric.accent {
        background: linear-gradient(135deg, #064d43 0%, #0a6b58 62%, #0d7894 100%);
        color: #f8fffd;
      }

      .control-metric.accent .summary-label,
      .control-metric.accent .summary-meta {
        color: inherit;
      }

      .control-metric strong {
        font-size: 2rem;
        line-height: 1;
      }

      .dashboard-actions-grid {
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      }

      .dashboard-action-card,
      .featured-tournament-card {
        display: grid;
        gap: 0.75rem;
        min-width: 0;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .dashboard-action-card p,
      .featured-tournament-card p {
        margin: 0;
      }

      .dashboard-action-card a {
        justify-self: start;
      }

      .featured-tournament-grid {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .alert-grid,
      .executive-grid,
      .operations-grid,
      .sport-grid,
      .tournament-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .executive-grid {
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }

      .operations-grid {
        align-items: start;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .alert-card,
      .executive-card,
      .operations-panel,
      .sport-card,
      .tournament-card {
        display: grid;
        gap: 0.85rem;
        min-width: 0;
        padding: 1rem 1.1rem;
      }

      .executive-card {
        align-content: start;
        min-height: 150px;
        border-top: 4px solid rgba(10, 107, 88, 0.22);
      }

      .executive-card.accent {
        background: linear-gradient(135deg, #064d43 0%, #0a6b58 58%, #0d7894 100%);
        border-color: rgba(10, 107, 88, 0.28);
        color: #f8fffd;
      }

      .executive-card.accent .summary-label,
      .executive-card.accent .summary-meta,
      .executive-card.accent .executive-value {
        color: inherit;
      }

      .executive-value {
        font-size: 2.25rem;
        line-height: 1;
      }

      .card-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }

      .panel-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .panel-heading h3 {
        margin: 0;
        font-size: 1rem;
      }

      .alert-type {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        padding: 0.3rem 0.65rem;
        border-radius: 999px;
        background: var(--surface-alt);
        color: var(--text-soft);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .alert-card p,
      .sport-card p,
      .tournament-card p {
        margin: 0;
      }

      .alert-header {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
        justify-content: space-between;
        min-width: 0;
      }

      .health-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 800;
        text-align: center;
      }

      .health-pill.healthy {
        background: #dcfce7;
        color: #166534;
      }

      .health-pill.warning {
        background: #fef3c7;
        color: #92400e;
      }

      .health-pill.attention {
        background: #fee2e2;
        color: #b91c1c;
      }

      .mini-metrics,
      .progress-metrics {
        display: grid;
        gap: 0.55rem;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      }

      .mini-metrics {
        color: var(--text-soft);
        font-size: 0.88rem;
      }

      .progress-metrics div {
        display: grid;
        gap: 0.2rem;
        padding: 0.8rem;
        border-radius: 0.85rem;
        background: var(--surface-alt);
      }

      .progress-label {
        color: var(--text-soft);
        font-size: 0.78rem;
      }

      .blocker-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .priority-list {
        display: grid;
        gap: 0.85rem;
      }

      .priority-item {
        display: grid;
        gap: 1rem;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        padding: 1rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .priority-rank {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        background: rgba(10, 110, 90, 0.12);
        color: var(--primary);
        font-weight: 800;
      }

      .blocker-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.65rem;
        border-radius: 999px;
        background: #fff7ed;
        color: #9a3412;
        font-size: 0.78rem;
        font-weight: 600;
      }

      .event-list,
      .governance-shell,
      .permission-editor-list,
      .permission-chip-list,
      .role-list,
      .top-actions {
        display: grid;
        gap: 0.75rem;
      }

      .event-item,
      .top-action-item {
        display: grid;
        gap: 0.45rem;
        min-width: 0;
        padding: 0.85rem;
        border-radius: 8px;
        background: var(--surface-alt);
      }

      .top-action-item {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
      }

      .stack-sm {
        min-width: 0;
      }

      .stack-sm strong,
      .stack-sm span,
      .event-context {
        overflow-wrap: anywhere;
      }

      .event-context,
      .top-action-total {
        color: var(--text-soft);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .top-action-total {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.5rem;
        padding: 0.35rem 0.65rem;
        border-radius: 999px;
        background: rgba(10, 110, 90, 0.12);
        color: var(--primary);
      }

      .governance-shell {
        margin-top: 1.25rem;
      }

      .governance-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .governance-banner {
        display: grid;
        gap: 0.35rem;
        margin: 1rem 0;
        padding: 0.9rem 1rem;
        border-radius: 8px;
        background: #ecfdf5;
        color: #166534;
      }

      .governance-banner.warning {
        background: #fef3c7;
        color: #92400e;
      }

      .role-card {
        display: grid;
        gap: 0.85rem;
        padding: 0.9rem;
        border-radius: 0.9rem;
        background: var(--surface-alt);
      }

      .role-card.editing {
        outline: 2px solid rgba(10, 110, 90, 0.18);
      }

      .permission-chip-list {
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      }

      .permission-chip {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        padding: 0.35rem 0.6rem;
        border-radius: 999px;
        background: rgba(10, 110, 90, 0.1);
        color: var(--primary);
        font-size: 0.78rem;
        font-weight: 600;
      }

      .editor-shell {
        display: grid;
        gap: 1rem;
      }

      .reason-field {
        display: grid;
        gap: 0.45rem;
      }

      .reason-field span {
        font-size: 0.85rem;
        font-weight: 700;
      }

      .reason-field textarea {
        width: 100%;
        min-height: 5rem;
        padding: 0.75rem 0.85rem;
        border: 1px solid rgba(15, 23, 42, 0.14);
        border-radius: 0.85rem;
        background: #fff;
        color: var(--text);
        font: inherit;
        resize: vertical;
      }

      .permission-option {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.75rem;
        align-items: start;
        padding: 0.85rem;
        border-radius: 0.85rem;
        background: var(--surface-alt);
      }

      .permission-option input {
        margin-top: 0.2rem;
      }

      .governance-error {
        color: #b91c1c;
      }

      .empty-state.compact {
        min-height: auto;
      }

      @media (max-width: 720px) {
        .control-hero {
          grid-template-columns: 1fr;
        }

        .priority-item {
          grid-template-columns: 1fr;
          align-items: start;
        }

        .card-actions {
          justify-content: flex-start;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly operationsService = inject(OperationsService);
  private readonly authorization = inject(AuthorizationService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly loading = signal(true);
  protected readonly operationsLoading = signal(false);
  protected readonly governanceSaving = signal(false);
  protected readonly summaryError = signal<string | null>(null);
  protected readonly activitySummaryError = signal<string | null>(null);
  protected readonly recentAuditEventsError = signal<string | null>(null);
  protected readonly governanceError = signal<string | null>(null);
  protected readonly governanceSaveError = signal<string | null>(null);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly activitySummary = signal<OperationalActivitySummary | null>(null);
  protected readonly recentAuditEvents = signal<OperationalAuditEvent[]>([]);
  protected readonly governanceSummary = signal<PermissionGovernanceSummary | null>(null);
  protected readonly editingRoleCode = signal<string | null>(null);
  protected readonly governanceReason = signal('');
  protected readonly selectedGovernancePermissions = signal<string[]>([]);
  protected readonly operationsVisible = computed(() => this.authorization.canReadOperationalAudit());
  protected readonly canManageTournaments = computed(() => this.authorization.canManage('tournaments'));
  protected readonly canManageGovernance = computed(() => this.authorization.canManagePermissionGovernance());
  protected readonly governanceWriteEnabled = computed(() => this.governanceSummary()?.writeEnabled ?? false);
  protected readonly mutableRoleCodes = computed(() => this.governanceSummary()?.mutableRoles ?? []);
  protected readonly governanceRoles = computed<ManagedRolePermission[]>(() => this.governanceSummary()?.roles ?? []);
  protected readonly availableGovernancePermissions = computed<ManagedPermission[]>(
    () => this.governanceSummary()?.availablePermissions ?? []
  );
  protected readonly editingRole = computed<ManagedRolePermission | null>(() => {
    const roleCode = this.editingRoleCode();
    if (!roleCode) {
      return null;
    }

    return this.governanceRoles().find((role) => role.roleCode === roleCode) ?? null;
  });
  protected readonly governanceCards = computed<DashboardCard[]>(() => {
    const summary = this.governanceSummary();
    const roles = summary?.roles ?? [];
    const mutableRoles = roles.filter((role) => role.mutable);

    return [
      {
        label: 'Roles',
        value: roles.length,
        meta: 'Incluidos en el resumen operativo'
      },
      {
        label: 'Mutables',
        value: mutableRoles.length,
        meta: `${summary?.mutableRoles.length ?? 0} habilitados por configuracion`
      },
      {
        label: 'Permisos',
        value: summary?.availablePermissions.length ?? 0,
        meta: 'Catalogo disponible'
      },
      {
        label: 'Escritura',
        value: summary?.writeEnabled ? 1 : 0,
        meta: summary?.writeEnabled ? 'Edicion disponible' : 'Edicion protegida',
        accent: summary?.writeEnabled ?? false
      }
    ];
  });
  protected readonly controlCards = computed<DashboardCard[]>(() => {
    const summary = this.summary();

    return [
      {
        label: 'Campeonatos activos',
        value: summary?.activeTournamentCount ?? 0,
        meta: `${summary?.liveTournamentCount ?? 0} en curso`,
        accent: (summary?.activeTournamentCount ?? 0) > 0
      },
      {
        label: 'Borradores',
        value: (summary?.setupTournamentCount ?? 0) + (summary?.sandboxTournamentCount ?? 0),
        meta: 'Por preparar o separar del foco'
      },
      {
        label: 'Partidos por jugar',
        value: summary?.scheduledMatchCount ?? 0,
        meta: 'Pendientes de resultado'
      },
      {
        label: 'Alertas',
        value: summary?.attentionTournamentCount ?? 0,
        meta: 'Campeonatos que requieren accion',
        accent: (summary?.attentionTournamentCount ?? 0) > 0
      }
    ];
  });
  protected readonly primaryActions = computed<DashboardAction[]>(() => {
    const actions: DashboardAction[] = [
      {
        label: 'Crear campeonato',
        description: 'Inicia una nueva competencia con datos basicos, formato y reglas.',
        cta: 'Crear',
        path: '/tournaments/new',
        queryParams: {},
        resource: 'tournaments',
        action: 'manage'
      },
      {
        label: 'Gestionar campeonatos',
        description: 'Abre el listado y entra al hub guiado de cada campeonato.',
        cta: 'Abrir campeonatos',
        path: '/tournaments',
        queryParams: {},
        resource: 'tournaments',
        action: 'read'
      },
      {
        label: 'Programar partido',
        description: 'Carga el siguiente encuentro cuando la base competitiva este lista.',
        cta: 'Programar',
        path: '/matches/new',
        queryParams: {},
        resource: 'matches',
        action: 'manage'
      },
      {
        label: 'Registrar resultado',
        description: 'Revisa partidos pendientes y completa marcadores para alimentar tabla.',
        cta: 'Ver partidos',
        path: '/matches',
        queryParams: { status: 'SCHEDULED' },
        resource: 'matches',
        action: 'read'
      },
      {
        label: 'Revisar tabla',
        description: 'Valida posiciones y detecta campeonatos con resultados sin tabla.',
        cta: 'Abrir tabla',
        path: '/standings',
        queryParams: {},
        resource: 'standings',
        action: 'read'
      },
      {
        label: 'Ver reportes',
        description: 'Accede a reportes y exportaciones para seguimiento operativo.',
        cta: 'Abrir reportes',
        path: '/reporting',
        queryParams: {},
        resource: 'tournaments',
        action: 'read'
      },
      {
        label: 'Abrir portal publico',
        description: 'Revisa la experiencia publica disponible para participantes y visitantes.',
        cta: 'Ver portal',
        path: '/portal',
        queryParams: {}
      }
    ];

    return actions.filter((action) => this.canUseAction(action));
  });
  protected readonly overviewCards = computed<DashboardCard[]>(() => {
    const summary = this.summary();

    return [
      {
        label: 'Deportes',
        value: summary?.sportCount ?? 0,
        meta: 'Catalogo activo'
      },
      {
        label: 'Torneos',
        value: summary?.tournamentCount ?? 0,
        meta: `${summary?.operationalTournamentCount ?? 0} con actividad real`,
        accent: true
      },
      {
        label: 'Borradores',
        value: summary?.sandboxTournamentCount ?? 0,
        meta: 'En preparacion o pruebas'
      },
      {
        label: 'Jugadores',
        value: summary?.playerCount ?? 0,
        meta: 'Jugadores cargados'
      }
    ];
  });
  protected readonly operationCards = computed<DashboardCard[]>(() => {
    const summary = this.summary();

    return [
      {
        label: 'Inscripciones',
        value: summary?.registrationCount ?? 0,
        meta: `${summary?.approvedRegistrationCount ?? 0} aprobadas`
      },
      {
        label: 'Planteles pendientes',
        value: summary?.rosterGapTournamentCount ?? 0,
        meta: 'Campeonatos con equipos sin plantel activo'
      },
      {
        label: 'Partidos jugados',
        value: summary?.playedMatchCount ?? 0,
        meta: `${summary?.scheduledMatchCount ?? 0} programados por disputar`
      },
      {
        label: 'Tablas pendientes',
        value: summary?.standingsGapTournamentCount ?? 0,
        meta: 'Campeonatos con resultados sin tabla'
      },
      {
        label: 'Torneos listos',
        value: summary?.readyTournamentCount ?? 0,
        meta: 'Flujo consistente de punta a punta'
      }
    ];
  });
  protected readonly executiveCards = computed<DashboardCard[]>(() => {
    const summary = this.summary();

    return [
      {
        label: 'Prioridades abiertas',
        value: summary?.attentionTournamentCount ?? 0,
        meta: 'Torneos que requieren seguimiento visible',
        accent: (summary?.attentionTournamentCount ?? 0) > 0
      },
      {
        label: 'Flujo listo',
        value: summary?.readyTournamentCount ?? 0,
        meta: 'Torneos con continuidad punta a punta'
      },
      {
        label: 'En preparacion',
        value: summary?.setupTournamentCount ?? 0,
        meta: 'Base competitiva aun en armado'
      },
      {
        label: 'Borradores',
        value: summary?.sandboxTournamentCount ?? 0,
        meta: 'En preparacion o pruebas'
      }
    ];
  });
  protected readonly alerts = computed<DashboardAlert[]>(() => this.summary()?.alerts ?? []);
  protected readonly priorityAlerts = computed<DashboardAlert[]>(() => this.alerts().slice(0, 3));
  protected readonly alertTypeCards = computed<DashboardCard[]>(() => {
    const alerts = this.alerts();
    const countByType = (type: DashboardAlert['type']) => alerts.filter((item) => item.type === type).length;

    return [
      {
        label: 'Inscripciones',
        value: countByType('registrations'),
        meta: 'Brechas de alta de equipos'
      },
      {
        label: 'Planteles',
        value: countByType('rosters'),
        meta: 'Aprobadas sin soporte activo'
      },
      {
        label: 'Partidos / tabla',
        value: countByType('matches') + countByType('standings'),
        meta: 'Partidos o tablas pendientes',
        accent: countByType('matches') + countByType('standings') > 0
      },
      {
        label: 'Estado / borrador',
        value: countByType('state') + countByType('sandbox'),
        meta: 'Seguimiento de estado y aislamiento'
      }
    ];
  });
  protected readonly sportSummaries = computed<DashboardSportSummary[]>(() => this.summary()?.sportSummaries ?? []);
  protected readonly auditCards = computed<DashboardCard[]>(() => {
    const summary = this.activitySummary();

    return [
      {
        label: 'Eventos',
        value: summary?.totalEvents ?? 0,
        meta: 'Actividad operativa registrada'
      },
      {
        label: 'Exitosos',
        value: summary?.successEvents ?? 0,
        meta: 'Operaciones completadas',
        accent: (summary?.failedEvents ?? 0) === 0 && (summary?.deniedEvents ?? 0) === 0 && (summary?.totalEvents ?? 0) > 0
      },
      {
        label: 'Denegados',
        value: summary?.deniedEvents ?? 0,
        meta: 'Intentos bloqueados por permiso'
      },
      {
        label: 'Fallidos',
        value: summary?.failedEvents ?? 0,
        meta: 'Operaciones con error visible',
        accent: (summary?.failedEvents ?? 0) > 0
      },
      {
        label: 'Actores',
        value: summary?.uniqueActors ?? 0,
        meta: 'Usuarios con actividad reciente'
      }
    ];
  });
  protected readonly topActions = computed(() => this.activitySummary()?.topActions ?? []);
  protected readonly tournamentSummaries = computed<DashboardTournamentSummary[]>(
    () => this.summary()?.tournamentSummaries ?? []
  );
  protected readonly highlightedTournaments = computed<DashboardTournamentSummary[]>(() =>
    [...this.tournamentSummaries()]
      .filter((item) => item.reportingSegment !== 'sandbox')
      .sort((left, right) => {
        const healthDiff = this.dashboardPriority(right) - this.dashboardPriority(left);
        if (healthDiff !== 0) {
          return healthDiff;
        }

        return right.readinessScore - left.readinessScore;
      })
      .slice(0, 4)
  );
  protected readonly operationalSummaries = computed<DashboardTournamentSummary[]>(() =>
    this.tournamentSummaries().filter((item) => item.reportingSegment === 'operational')
  );
  protected readonly sandboxSummaries = computed<DashboardTournamentSummary[]>(() =>
    this.tournamentSummaries().filter((item) => item.reportingSegment === 'sandbox')
  );
  protected readonly healthMessage = computed(() => {
    const summary = this.summary();
    if (!summary) {
      return '';
    }

    if (summary.tournamentCount === 0) {
      return 'No hay campeonatos cargados. El siguiente paso es crear una competencia para activar el flujo multideporte.';
    }

    if (summary.attentionTournamentCount > 0) {
      return `Hay ${summary.attentionTournamentCount} campeonatos con alertas que requieren seguimiento.`;
    }

    if (summary.registrationCount === 0) {
      return 'Hay torneos pero aun no existen inscripciones. Conviene continuar por Inscripciones para poblar la operacion.';
    }

    if (summary.matchCount === 0) {
      return 'La base competitiva ya existe, pero falta programar partidos para comenzar a generar resultados y tabla.';
    }

    return 'La plataforma ya muestra una vista general de la salud de los campeonatos.';
  });
  protected readonly controlHeadline = computed(() => {
    const summary = this.summary();

    if (!summary || summary.tournamentCount === 0) {
      return 'Crea tu primer campeonato para activar el centro de control';
    }

    if (summary.attentionTournamentCount > 0) {
      return `${summary.attentionTournamentCount} campeonato(s) necesitan atencion`;
    }

    if (summary.scheduledMatchCount > 0) {
      return `${summary.scheduledMatchCount} partido(s) esperan seguimiento`;
    }

    return 'Tus campeonatos tienen una lectura estable';
  });
  protected readonly controlMessage = computed(() => {
    const summary = this.summary();

    if (!summary || summary.tournamentCount === 0) {
      return 'Empieza creando un campeonato y luego continua por inscripciones, planteles, partidos y tabla.';
    }

    if (summary.attentionTournamentCount > 0) {
      return 'Entra al hub guiado del campeonato destacado para resolver el siguiente paso sin recorrer modulos sueltos.';
    }

    if (summary.scheduledMatchCount > 0) {
      return 'Revisa partidos programados y registra resultados para mantener la tabla al dia.';
    }

    return 'Puedes revisar reportes, tabla o portal publico desde los accesos principales.';
  });

  constructor() {
    this.loadSummary();

    if (this.operationsVisible()) {
      this.loadOperationalReadout();
    }
  }

  protected loadSummary(): void {
    this.loading.set(true);
    this.summaryError.set(null);
    this.dashboardService
      .getSummary()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.summaryError.set(null);
        },
        error: (error: unknown) => {
          const message = this.errorMapper.map(error).message;
          this.summary.set(null);
          this.summaryError.set(message);
          this.notifications.error(message);
        }
      });
  }

  private loadOperationalReadout(): void {
    this.operationsLoading.set(true);
    this.activitySummaryError.set(null);
    this.recentAuditEventsError.set(null);
    this.governanceError.set(null);

    forkJoin({
      activitySummary: this.operationsService.getActivitySummary().pipe(
        catchError((error: unknown) => {
          this.activitySummaryError.set(this.errorMapper.map(error).message);
          return of(null);
        })
      ),
      recentAuditEvents: this.operationsService.getRecentAuditEvents(8).pipe(
        catchError((error: unknown) => {
          this.recentAuditEventsError.set(this.errorMapper.map(error).message);
          return of([]);
        })
      ),
      governanceSummary: this.operationsService.getPermissionGovernanceSummary().pipe(
        catchError((error: unknown) => {
          this.governanceError.set(this.errorMapper.map(error).message);
          return of(null);
        })
      )
    })
      .pipe(finalize(() => this.operationsLoading.set(false)))
      .subscribe(({ activitySummary, recentAuditEvents, governanceSummary }) => {
        this.activitySummary.set(activitySummary);
        this.recentAuditEvents.set(recentAuditEvents);
        this.governanceSummary.set(governanceSummary);
      });
  }

  protected healthLabel(health: DashboardHealth): string {
    const labels: Record<DashboardHealth, string> = {
      healthy: 'Estable',
      warning: 'Seguimiento',
      attention: 'Prioridad'
    };

    return labels[health];
  }

  protected healthClass(health: DashboardHealth): string {
    return health;
  }

  protected auditLabel(status: DashboardTournamentSummary['auditStatus']): string {
    const labels: Record<DashboardTournamentSummary['auditStatus'], string> = {
      blocked: 'Bloqueado',
      partial: 'Parcial',
      ready: 'Listo'
    };

    return labels[status];
  }

  protected statusLabel(status: TournamentStatus): string {
    const labels: Record<TournamentStatus, string> = {
      DRAFT: 'Borrador',
      OPEN: 'Inscripciones abiertas',
      IN_PROGRESS: 'En curso',
      FINISHED: 'Finalizado',
      CANCELLED: 'Cancelado'
    };

    return labels[status];
  }

  protected segmentLabel(segment: DashboardTournamentSummary['reportingSegment']): string {
    const labels: Record<DashboardTournamentSummary['reportingSegment'], string> = {
      operational: 'Operativo',
      setup: 'Preparacion',
      sandbox: 'Borrador'
    };

    return labels[segment];
  }

  protected leaderLabel(tournament: DashboardTournamentSummary): string {
    if (!tournament.leaderName) {
      return 'Sin tabla visible';
    }

    return `${tournament.leaderName} (${tournament.leaderPoints ?? 0} pts)`;
  }

  protected alertTypeLabel(type: DashboardAlert['type']): string {
    const labels: Record<DashboardAlert['type'], string> = {
      registrations: 'Inscripciones',
      rosters: 'Planteles',
      matches: 'Partidos',
      standings: 'Tabla',
      state: 'Estado',
      sandbox: 'Borrador'
    };

    return labels[type];
  }

  protected resultLabel(result: OperationalAuditResult): string {
    const labels: Record<OperationalAuditResult, string> = {
      SUCCESS: 'Exitoso',
      DENIED: 'Denegado',
      FAILED: 'Fallido'
    };

    return labels[result];
  }

  protected resultClass(result: OperationalAuditResult): string {
    const classes: Record<OperationalAuditResult, string> = {
      SUCCESS: 'healthy',
      DENIED: 'warning',
      FAILED: 'attention'
    };

    return classes[result];
  }

  protected actionLabel(action: string): string {
    const labels: Record<string, string> = {
      AUTH_LOGIN_SUCCESS: 'Ingreso exitoso',
      AUTH_LOGIN_FAILED: 'Ingreso fallido',
      AUTH_REFRESH_SUCCESS: 'Sesion renovada',
      AUTH_LOGOUT_SUCCESS: 'Salida del sistema',
      SECURITY_ACCESS_DENIED: 'Acceso denegado',
      OPERATIONAL_ACTIVITY_READ: 'Lectura de actividad operativa',
      TOURNAMENT_OPERATIONAL_SUMMARY_READ: 'Lectura de resumen operativo',
      PERMISSION_GOVERNANCE_SUMMARY: 'Lectura de gobierno de permisos',
      PERMISSION_ROLE_ASSIGNMENTS_UPDATED: 'Actualizacion de permisos por rol',
      PERMISSION_ROLE_ASSIGNMENTS_UPDATE_DENIED: 'Actualizacion denegada de permisos por rol',
      PERMISSION_ROLE_ASSIGNMENTS_UPDATE_FAILED: 'Actualizacion fallida de permisos por rol',
      TOURNAMENT_CREATE: 'Campeonato creado',
      TOURNAMENT_UPDATE: 'Campeonato actualizado',
      TOURNAMENT_STATUS_TRANSITION: 'Cambio de estado de campeonato',
      TOURNAMENT_TEAM_CREATE: 'Equipo inscrito',
      TOURNAMENT_TEAM_UPDATE: 'Equipo actualizado',
      TEAM_CREATE: 'Equipo creado',
      TEAM_UPDATE: 'Equipo actualizado',
      PLAYER_CREATE: 'Jugador creado',
      PLAYER_UPDATE: 'Jugador actualizado',
      TOURNAMENT_ROSTER_CREATE: 'Plantel creado',
      TOURNAMENT_ROSTER_UPDATE: 'Plantel actualizado',
      ROSTER_CREATE: 'Plantel creado',
      ROSTER_UPDATE: 'Plantel actualizado',
      STAGE_GROUP_CREATE: 'Grupo creado',
      STAGE_GROUP_UPDATE: 'Grupo actualizado',
      MATCH_CREATE: 'Partido creado',
      MATCH_UPDATE: 'Partido actualizado',
      MATCH_RESULT_UPDATE: 'Resultado actualizado',
      MATCH_EVENT_CREATE: 'Evento de partido registrado',
      STANDINGS_READ: 'Consulta de tabla de posiciones',
      STANDING_RECALCULATE: 'Tabla recalculada',
      STANDINGS_RECALCULATE: 'Tabla recalculada',
      REPORT_EXPORT: 'Reporte exportado'
    };

    return labels[action] ?? this.humanizeCode(action);
  }

  protected actionCategoryLabel(action: string): string {
    if (action.startsWith('AUTH_')) {
      return 'Acceso de usuarios';
    }

    if (action.startsWith('TOURNAMENT_') || action.startsWith('TEAM_') || action.startsWith('PLAYER_') || action.startsWith('ROSTER_')) {
      return 'Gestion de campeonatos';
    }

    if (action.startsWith('MATCH_') || action.startsWith('STAGE_')) {
      return 'Gestion de partidos';
    }

    if (action.startsWith('PERMISSION_') || action.startsWith('SECURITY_')) {
      return 'Administracion';
    }

    if (action.startsWith('REPORT_') || action.startsWith('STANDINGS_')) {
      return 'Reportes y seguimiento';
    }

    return 'Actividad operativa';
  }

  protected startGovernanceEdit(role: ManagedRolePermission): void {
    this.editingRoleCode.set(role.roleCode);
    this.selectedGovernancePermissions.set([...role.permissionCodes]);
    this.governanceReason.set('');
    this.governanceSaveError.set(null);
  }

  protected cancelGovernanceEdit(): void {
    this.editingRoleCode.set(null);
    this.selectedGovernancePermissions.set([]);
    this.governanceReason.set('');
    this.governanceSaveError.set(null);
  }

  protected toggleGovernancePermission(permissionCode: string): void {
    const selected = this.selectedGovernancePermissions();
    const next = selected.includes(permissionCode)
      ? selected.filter((code) => code !== permissionCode)
      : [...selected, permissionCode].sort((left, right) => left.localeCompare(right));

    this.selectedGovernancePermissions.set(next);
    this.governanceSaveError.set(null);
  }

  protected isGovernancePermissionSelected(permissionCode: string): boolean {
    return this.selectedGovernancePermissions().includes(permissionCode);
  }

  protected roleLabel(role: ManagedRolePermission): string {
    if (role.mutable) {
      return 'Rol editable para operacion diaria';
    }

    return 'Rol protegido por configuracion del sistema';
  }

  protected permissionLabel(permissionCode: string): string {
    const labels: Record<string, string> = {
      'auth:session:read': 'Ver sesion activa',
      'dashboard:read': 'Ver inicio',
      'sports:read': 'Ver deportes',
      'tournaments:read': 'Ver campeonatos',
      'tournaments:manage': 'Gestionar campeonatos',
      'tournaments:delete': 'Eliminar campeonatos',
      'tournaments:status-transition': 'Cambiar estado de campeonato',
      'tournaments:generate-knockout-bracket': 'Generar eliminatoria',
      'tournaments:progress-to-knockout': 'Avanzar a eliminatoria',
      'teams:read': 'Ver equipos',
      'teams:manage': 'Gestionar equipos',
      'teams:delete': 'Eliminar equipos',
      'players:read': 'Ver jugadores',
      'players:manage': 'Gestionar jugadores',
      'players:delete': 'Eliminar jugadores',
      'tournament-teams:read': 'Ver inscripciones',
      'tournament-teams:manage': 'Gestionar inscripciones',
      'tournament-teams:delete': 'Eliminar inscripciones',
      'tournamentteams:read': 'Ver inscripciones',
      'tournamentteams:manage': 'Gestionar inscripciones',
      'tournamentteams:delete': 'Eliminar inscripciones',
      'stages:read': 'Ver etapas',
      'stages:manage': 'Gestionar etapas',
      'stages:delete': 'Eliminar etapas',
      'tournamentstages:read': 'Ver etapas',
      'tournamentstages:manage': 'Gestionar etapas',
      'tournamentstages:delete': 'Eliminar etapas',
      'stage-groups:read': 'Ver grupos',
      'stage-groups:manage': 'Gestionar grupos',
      'stage-groups:delete': 'Eliminar grupos',
      'stagegroups:read': 'Ver grupos',
      'stagegroups:manage': 'Gestionar grupos',
      'stagegroups:delete': 'Eliminar grupos',
      'rosters:read': 'Ver planteles',
      'rosters:manage': 'Gestionar planteles',
      'rosters:delete': 'Eliminar planteles',
      'matches:read': 'Ver partidos',
      'matches:manage': 'Gestionar partidos',
      'matches:delete': 'Eliminar partidos',
      'standings:read': 'Ver tabla de posiciones',
      'standings:manage': 'Gestionar tabla de posiciones',
      'standings:delete': 'Eliminar tabla de posiciones',
      'standings:recalculate': 'Recalcular tabla de posiciones',
      'operations:audit:read': 'Ver actividad administrativa',
      'permissions:govern:manage': 'Gestionar permisos',
      'configuration:basic:read': 'Ver configuracion basica',
      'configuration:basic:manage': 'Gestionar configuracion basica',
      'users:read': 'Ver usuarios',
      'users:manage': 'Gestionar usuarios'
    };

    return labels[permissionCode] ?? this.humanizeCode(permissionCode);
  }

  private canUseAction(action: DashboardAction): boolean {
    if (!action.resource || !action.action) {
      return true;
    }

    return action.action === 'manage'
      ? this.authorization.canManage(action.resource)
      : this.authorization.canRead(action.resource);
  }

  private dashboardPriority(tournament: DashboardTournamentSummary): number {
    let score = 0;

    if (tournament.health === 'attention') {
      score += 40;
    } else if (tournament.health === 'warning') {
      score += 20;
    }

    if (tournament.status === 'IN_PROGRESS') {
      score += 30;
    } else if (tournament.status === 'OPEN') {
      score += 20;
    }

    if (tournament.rosterGapCount > 0 || (tournament.playedMatchCount > 0 && tournament.standingsCount === 0)) {
      score += 10;
    }

    return score;
  }

  protected updateGovernanceReason(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    this.governanceReason.set(target?.value ?? '');
    this.governanceSaveError.set(null);
  }

  protected canSubmitGovernanceEdit(): boolean {
    return !!this.editingRole() && this.selectedGovernancePermissions().length > 0 && this.governanceReason().trim().length > 0;
  }

  protected saveGovernanceEdit(): void {
    const role = this.editingRole();
    if (!role || !this.canSubmitGovernanceEdit()) {
      return;
    }

    this.governanceSaving.set(true);
    this.governanceSaveError.set(null);

    this.operationsService
      .updateRolePermissions(role.roleCode, {
        permissionCodes: [...this.selectedGovernancePermissions()],
        reason: this.governanceReason().trim()
      })
      .pipe(finalize(() => this.governanceSaving.set(false)))
      .subscribe({
        next: (updatedRole) => {
          const currentSummary = this.governanceSummary();
          if (currentSummary) {
            this.governanceSummary.set({
              ...currentSummary,
              generatedAt: new Date().toISOString(),
              roles: currentSummary.roles.map((item) => (item.roleCode === updatedRole.roleCode ? updatedRole : item))
            });
          }

          this.notifications.success(`Permisos actualizados para ${updatedRole.roleName}.`);
          this.startGovernanceEdit(updatedRole);
        },
        error: (error: unknown) => {
          this.governanceSaveError.set(this.errorMapper.map(error).message);
        }
      });
  }

  protected entityLabel(event: OperationalAuditEvent): string {
    const entityId = event.entityId ? ` #${event.entityId}` : '';
    const entityLabels: Record<string, string> = {
      AUTH_SESSION: 'Sesion',
      TOURNAMENT: 'Campeonato',
      TOURNAMENT_TEAM: 'Equipo',
      TEAM: 'Equipo',
      PLAYER: 'Jugador',
      ROSTER: 'Plantel',
      MATCH: 'Partido',
      MATCH_EVENT: 'Evento de partido',
      STANDING: 'Tabla de posiciones',
      REPORT: 'Reporte',
      ROLE: 'Rol',
      PERMISSION: 'Permiso',
      USER: 'Usuario'
    };

    const label = entityLabels[event.entityType] ?? this.humanizeCode(event.entityType);
    return `${label}${entityId}`;
  }

  protected eventDetail(event: OperationalAuditEvent): string {
    if (event.result === 'DENIED') {
      return 'Se registro un acceso o accion bloqueada por permisos.';
    }

    if (event.result === 'FAILED') {
      return 'Se registro una accion que no pudo completarse correctamente.';
    }

    return 'Se registro una accion reciente en la actividad del sistema.';
  }

  protected contextLine(event: OperationalAuditEvent): string {
    const reasonCode = this.readContextValue(event.context, 'reasonCode');

    return reasonCode ? `Motivo: ${this.humanizeCode(reasonCode)}` : '';
  }

  protected formatOccurredAt(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Fecha no disponible';
    }

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(parsed);
  }

  private readContextValue(context: Record<string, unknown>, key: string): string | null {
    const value = context[key];

    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  private humanizeCode(value: string): string {
    return value
      .toLowerCase()
      .split(/[_:.-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
