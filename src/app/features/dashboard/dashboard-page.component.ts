import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AuthorizationService } from '../../core/auth/authorization.service';
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

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, PageHeaderComponent, LoadingStateComponent],
  template: `
    <section class="app-page">
      <app-page-header
        title="Dashboard Ejecutivo"
        subtitle="Reporting transversal del estado multideporte, la cobertura operativa y la auditoria de trazabilidad por torneo."
      />

      @if (loading()) {
        <app-loading-state />
      } @else {
        <div class="context-banner">
          <strong>Resumen transversal del sistema</strong>
          <span class="muted">{{ healthMessage() }}</span>
        </div>

        <div class="executive-grid">
          @for (card of executiveCards(); track card.label) {
            <article class="executive-card card" [class.accent]="card.accent">
              <span class="summary-label">{{ card.label }}</span>
              <strong class="executive-value">{{ card.value }}</strong>
              <span class="summary-meta">{{ card.meta }}</span>
            </article>
          }
        </div>

        @if (operationsVisible()) {
          <section class="card page-card app-page">
            <div class="section-heading">
              <div>
                <h2>Actividad operativa reciente</h2>
                <p class="muted">Lectura breve de auditoria y observabilidad operativa sobre contrato backend real.</p>
              </div>
              <span class="section-badge">Permiso operations:audit:read</span>
            </div>

            @if (operationsLoading()) {
              <app-loading-state label="Cargando actividad operativa..." />
            } @else {
              <div class="operations-grid">
                <article class="operations-panel card">
                  <div class="panel-heading">
                    <h3>Resumen de actividad</h3>
                    <span class="muted">Backend / activity-summary</span>
                  </div>

                  @if (activitySummaryError()) {
                    <div class="empty-state compact">
                      <strong>No se pudo cargar el resumen operativo.</strong>
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
                    <span class="muted">Backend / audit-events/recent</span>
                  </div>

                  @if (recentAuditEventsError()) {
                    <div class="empty-state compact">
                      <strong>No se pudo cargar la actividad operativa reciente.</strong>
                      <p class="muted">{{ recentAuditEventsError() }}</p>
                    </div>
                  } @else if (recentAuditEvents().length === 0) {
                    <div class="empty-state compact">
                      <strong>No hay actividad operativa reciente.</strong>
                      <p class="muted">Backend no reporta eventos recientes dentro de la ventana actual.</p>
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
                    <span class="muted">Top actions / activity-summary</span>
                  </div>

                  @if (activitySummaryError()) {
                    <div class="empty-state compact">
                      <strong>No se pudo cargar el ranking de acciones.</strong>
                      <p class="muted">{{ activitySummaryError() }}</p>
                    </div>
                  } @else if (topActions().length === 0) {
                    <div class="empty-state compact">
                      <strong>No hay acciones frecuentes para resumir.</strong>
                      <p class="muted">El summary operativo actual no registra volumen suficiente para ranking.</p>
                    </div>
                  } @else {
                    <div class="top-actions">
                      @for (item of topActions(); track item.action) {
                        <article class="top-action-item">
                          <div class="stack-sm">
                            <strong>{{ actionLabel(item.action) }}</strong>
                            <span class="muted">{{ item.action }}</span>
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
                    <h2>Gobierno operativo de permisos</h2>
                    <p class="muted">
                      Adopcion minima del contrato backend real para lectura auditada y actualizacion controlada por rol.
                    </p>
                  </div>
                  <span class="section-badge">
                    {{ canManageGovernance() ? 'permissions:govern:manage' : 'Lectura auditada' }}
                  </span>
                </div>

                @if (governanceError()) {
                  <div class="empty-state compact">
                    <strong>No se pudo cargar el resumen de gobierno operativo.</strong>
                    <p class="muted">{{ governanceError() }}</p>
                  </div>
                } @else if (!governanceSummary()) {
                  <div class="empty-state compact">
                    <strong>No hay resumen de gobierno operativo disponible.</strong>
                    <p class="muted">Backend no devolvio datos para el contrato de roles y permisos.</p>
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
                    <strong>{{ governanceWriteEnabled() ? 'Escritura habilitada en este ambiente' : 'Escritura deshabilitada en este ambiente' }}</strong>
                    <span class="muted">
                      Generado {{ formatOccurredAt(governanceSummary()!.generatedAt) }}.
                      Roles mutables: {{ mutableRoleCodes().join(', ') || 'ninguno' }}.
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
                                <span class="muted">{{ role.roleCode }}</span>
                              </div>
                              <span class="health-pill" [class]="role.mutable ? 'healthy' : 'warning'">
                                {{ role.mutable ? 'Mutable' : 'Inmutable' }}
                              </span>
                            </div>

                            <div class="permission-chip-list">
                              @for (permissionCode of role.permissionCodes; track permissionCode) {
                                <span class="permission-chip">{{ permissionCode }}</span>
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
                        <span class="muted">PUT /operations/permission-governance/roles/&lt;roleCode&gt;</span>
                      </div>

                      @if (!canManageGovernance()) {
                        <div class="empty-state compact">
                          <strong>La sesion actual no puede editar asignaciones.</strong>
                          <p class="muted">El backend requiere el permiso permissions:govern:manage para actualizar permisos por rol.</p>
                        </div>
                      } @else if (!governanceWriteEnabled()) {
                        <div class="empty-state compact">
                          <strong>La escritura esta cerrada en este ambiente.</strong>
                          <p class="muted">La UI refleja writeEnabled = false y no intenta abrir una consola operativa paralela.</p>
                        </div>
                      } @else if (!editingRole()) {
                        <div class="empty-state compact">
                          <strong>Seleccionar un rol mutable.</strong>
                          <p class="muted">El editor queda acotado a los roles que backend habilito para esta etapa.</p>
                        </div>
                      } @else {
                        <div class="editor-shell">
                          <div class="stack-sm">
                            <strong>{{ editingRole()!.roleName }}</strong>
                            <span class="muted">{{ editingRole()!.roleCode }}</span>
                          </div>

                          <label class="reason-field">
                            <span>Razon operativa</span>
                            <textarea
                              rows="3"
                              [value]="governanceReason()"
                              (input)="updateGovernanceReason($event)"
                              placeholder="Ejemplo: ajustar alcance operativo del rol OPERATOR para ventana controlada"
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
                                  <strong>{{ permission.code }}</strong>
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
                <p class="muted">Lectura corta de los frentes que mas impactan continuidad y confianza operativa.</p>
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
                    <a mat-button [routerLink]="['/tournaments', alert.tournamentId]">Detalle</a>
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
              <h2>Auditoria operativa</h2>
              <p class="muted">Lectura del flujo inscripciones -> roster -> partidos -> standings sobre torneos con actividad real.</p>
            </div>
            <span class="section-badge">{{ operationalSummaries().length }} en foco</span>
          </div>

          @if (operationalSummaries().length === 0) {
            <div class="empty-state">
              <strong>No hay torneos operativos para auditar.</strong>
              <p class="muted">El foco actual esta en configurar la base o depurar registros QA fuera del radar principal.</p>
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
                      <span class="progress-label">Madurez operativa</span>
                      <strong>{{ tournament.readinessScore }}%</strong>
                    </div>
                    <div>
                      <span class="progress-label">Cobertura roster</span>
                      <strong>{{ tournament.registrationsWithActiveRosterCount }}/{{ tournament.approvedRegistrationCount }}</strong>
                    </div>
                    <div>
                      <span class="progress-label">Cobertura standings</span>
                      <strong>{{ tournament.standingsCoverageCount }}/{{ tournament.approvedRegistrationCount }}</strong>
                    </div>
                  </div>

                  <div class="mini-metrics">
                    <span>Inscripciones aprobadas: {{ tournament.approvedRegistrationCount }}</span>
                    <span>Sin roster activo: {{ tournament.rosterGapCount }}</span>
                    <span>Partidos jugados: {{ tournament.playedMatchCount }}/{{ tournament.matchCount }}</span>
                    <span>Standings: {{ tournament.standingsCount }}</span>
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
                    <a mat-button [routerLink]="['/tournaments', tournament.tournamentId]">Abrir detalle</a>
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
              <p class="muted">Torneos que conviene atender primero para no perder continuidad operativa.</p>
            </div>
            <span class="section-badge">{{ alerts().length }} abiertas</span>
          </div>

          @if (alerts().length === 0) {
            <div class="empty-state">
              <strong>No hay alertas operativas prioritarias.</strong>
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
                    <a mat-button [routerLink]="['/tournaments', alert.tournamentId]">Detalle</a>
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
                  <span>Rosters activos: {{ sport.activeRosterCount }}</span>
                  <span>Partidos jugados: {{ sport.playedMatchCount }}/{{ sport.matchCount }}</span>
                  <span>Standings: {{ sport.standingsCount }}</span>
                </div>
              </article>
            }
          </div>
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>Seguimiento por torneo</h2>
              <p class="muted">Backlog operativo visible para decidir el siguiente bloque funcional con bajo riesgo.</p>
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
                    <span>Con roster: {{ tournament.registrationsWithActiveRosterCount }}/{{ tournament.approvedRegistrationCount }}</span>
                    <span>Rosters activos: {{ tournament.activeRosterCount }}</span>
                    <span>Partidos: {{ tournament.playedMatchCount }}/{{ tournament.matchCount }} jugados</span>
                    <span>Incidencias: {{ tournament.incidentMatchCount }}</span>
                    <span>Standings: {{ tournament.standingsCount }}</span>
                    <span>Lider: {{ leaderLabel(tournament) }}</span>
                  </div>

                  <p class="muted">{{ tournament.nextAction }}</p>

                  <div class="card-actions">
                    <a mat-button [routerLink]="['/tournaments', tournament.tournamentId]">Abrir detalle</a>
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section class="card page-card app-page">
          <div class="section-heading">
            <div>
              <h2>QA y borradores</h2>
              <p class="muted">Torneos que hoy conviene mantener fuera del reporting ejecutivo principal para reducir ruido.</p>
            </div>
            <span class="section-badge">{{ sandboxSummaries().length }} aislados</span>
          </div>

          @if (sandboxSummaries().length === 0) {
            <div class="empty-state">
              <strong>No hay torneos QA o borrador fuera del foco principal.</strong>
              <p class="muted">La lectura ejecutiva actual ya se apoya solo en torneos con valor operativo.</p>
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
                    <a mat-button [routerLink]="['/tournaments', tournament.tournamentId]">Abrir detalle</a>
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
        background: var(--surface-alt);
        color: var(--text-soft);
        font-size: 0.85rem;
        font-weight: 600;
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
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .operations-grid {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }

      .alert-card,
      .executive-card,
      .operations-panel,
      .sport-card,
      .tournament-card {
        display: grid;
        gap: 0.85rem;
        padding: 1rem 1.1rem;
      }

      .executive-card {
        align-content: start;
      }

      .executive-card.accent {
        background: linear-gradient(135deg, #0a6e5a 0%, #11806a 100%);
        border-color: rgba(10, 110, 90, 0.28);
        color: #f8fffd;
      }

      .executive-card.accent .summary-label,
      .executive-card.accent .summary-meta,
      .executive-card.accent .executive-value {
        color: inherit;
      }

      .executive-value {
        font-size: 2.15rem;
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
        gap: 0.75rem;
        align-items: center;
        justify-content: space-between;
      }

      .health-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
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
        border-radius: 1rem;
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
        padding: 0.85rem;
        border-radius: 0.9rem;
        background: var(--surface-alt);
      }

      .top-action-item {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
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
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }

      .governance-banner {
        display: grid;
        gap: 0.35rem;
        margin: 1rem 0;
        padding: 0.9rem 1rem;
        border-radius: 1rem;
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
        meta: 'Catalogo backend disponible'
      },
      {
        label: 'Escritura',
        value: summary?.writeEnabled ? 1 : 0,
        meta: summary?.writeEnabled ? 'Ambiente editable' : 'Ambiente protegido',
        accent: summary?.writeEnabled ?? false
      }
    ];
  });
  protected readonly overviewCards = computed<DashboardCard[]>(() => {
    const summary = this.summary();

    return [
      {
        label: 'Deportes',
        value: summary?.sportCount ?? 0,
        meta: 'Catalogo base activo'
      },
      {
        label: 'Torneos',
        value: summary?.tournamentCount ?? 0,
        meta: `${summary?.operationalTournamentCount ?? 0} con actividad real`,
        accent: true
      },
      {
        label: 'QA / borrador',
        value: summary?.sandboxTournamentCount ?? 0,
        meta: 'Fuera del radar principal'
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
        label: 'Brecha de roster',
        value: summary?.rosterGapTournamentCount ?? 0,
        meta: 'Torneos con aprobadas sin roster activo'
      },
      {
        label: 'Partidos jugados',
        value: summary?.playedMatchCount ?? 0,
        meta: `${summary?.scheduledMatchCount ?? 0} programados por disputar`
      },
      {
        label: 'Brecha de standings',
        value: summary?.standingsGapTournamentCount ?? 0,
        meta: 'Torneos con resultados sin tabla'
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
        label: 'QA aislado',
        value: summary?.sandboxTournamentCount ?? 0,
        meta: 'Fuera del radar ejecutivo principal'
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
        label: 'Rosters',
        value: countByType('rosters'),
        meta: 'Aprobadas sin soporte activo'
      },
      {
        label: 'Fixture / tabla',
        value: countByType('matches') + countByType('standings'),
        meta: 'Partidos o standings pendientes',
        accent: countByType('matches') + countByType('standings') > 0
      },
      {
        label: 'Estado / QA',
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
      return 'No hay torneos cargados. El siguiente paso operativo es crear una competencia para activar el flujo multideporte.';
    }

    if (summary.attentionTournamentCount > 0) {
      return `Hay ${summary.attentionTournamentCount} torneos con alertas operativas reportadas por backend. Esta fase debe enfocarse en adoptar ese resumen sin reabrir el baseline estable.`;
    }

    if (summary.registrationCount === 0) {
      return 'Hay torneos pero aun no existen inscripciones. Conviene continuar por Inscripciones para poblar la operacion.';
    }

    if (summary.matchCount === 0) {
      return 'La base competitiva ya existe, pero falta programar partidos para comenzar a generar resultados y standings.';
    }

    return 'El frontend ya puede apoyarse en una vista ejecutiva transversal con salud operativa respaldada progresivamente por backend.';
  });

  constructor() {
    this.dashboardService
      .getSummary()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });

    if (this.operationsVisible()) {
      this.loadOperationalReadout();
    }
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
      OPEN: 'Abierto',
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
      sandbox: 'QA / borrador'
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
      rosters: 'Rosters',
      matches: 'Partidos',
      standings: 'Standings',
      state: 'Estado',
      sandbox: 'QA / borrador'
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
      AUTH_LOGIN_SUCCESS: 'Login exitoso',
      AUTH_LOGIN_FAILED: 'Login fallido',
      AUTH_REFRESH_SUCCESS: 'Refresh exitoso',
      AUTH_LOGOUT_SUCCESS: 'Logout exitoso',
      SECURITY_ACCESS_DENIED: 'Acceso denegado',
      OPERATIONAL_ACTIVITY_READ: 'Lectura de actividad operativa',
      TOURNAMENT_OPERATIONAL_SUMMARY_READ: 'Lectura de resumen operativo',
      PERMISSION_GOVERNANCE_SUMMARY: 'Lectura de gobierno de permisos',
      PERMISSION_ROLE_ASSIGNMENTS_UPDATED: 'Actualizacion de permisos por rol',
      PERMISSION_ROLE_ASSIGNMENTS_UPDATE_DENIED: 'Actualizacion denegada de permisos por rol',
      PERMISSION_ROLE_ASSIGNMENTS_UPDATE_FAILED: 'Actualizacion fallida de permisos por rol'
    };

    return labels[action] ?? action;
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
    return `${event.entityType}${entityId}`;
  }

  protected eventDetail(event: OperationalAuditEvent): string {
    if (event.result === 'DENIED') {
      return 'El backend registro un acceso o accion bloqueada por permisos o politica operativa.';
    }

    if (event.result === 'FAILED') {
      return 'El backend registro una operacion que no pudo completarse correctamente.';
    }

    return 'El backend confirmo una operacion reciente dentro de la trazabilidad operativa visible.';
  }

  protected contextLine(event: OperationalAuditEvent): string {
    const requestPath = this.readContextValue(event.context, 'requestPath');
    const httpMethod = this.readContextValue(event.context, 'httpMethod');
    const reasonCode = this.readContextValue(event.context, 'reasonCode');

    const parts = [httpMethod, requestPath, reasonCode].filter((item): item is string => !!item);
    return parts.join(' / ');
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
}
