import { Injectable, inject } from '@angular/core';

import { AppPermission } from './auth.models';
import { AuthStore } from './auth.store';

export type AuthorizationResource =
  | 'dashboard'
  | 'sports'
  | 'teams'
  | 'players'
  | 'tournaments'
  | 'tournamentTeams'
  | 'tournamentStages'
  | 'stageGroups'
  | 'rosters'
  | 'matches'
  | 'standings';

export type AuthorizationAction = 'read' | 'manage' | 'delete' | 'status-transition' | 'recalculate';

@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly authStore = inject(AuthStore);

  canAccess(resource: AuthorizationResource, action: AuthorizationAction): boolean {
    return this.hasPermission(this.permissionKey(resource, action));
  }

  canRead(resource: AuthorizationResource): boolean {
    return this.canAccess(resource, 'read');
  }

  canManage(resource: AuthorizationResource): boolean {
    return this.canAccess(resource, 'manage');
  }

  canDelete(resource: AuthorizationResource): boolean {
    return this.canAccess(resource, 'delete');
  }

  canTransitionTournamentStatus(): boolean {
    return this.hasPermission('tournaments:status-transition');
  }

  canRecalculateStandings(): boolean {
    return this.hasPermission('standings:recalculate');
  }

  canReadOperationalAudit(): boolean {
    return this.hasPermission('operations:audit:read');
  }

  canManagePermissionGovernance(): boolean {
    return this.hasPermission('permissions:govern:manage');
  }

  canProgressTournamentToKnockout(): boolean {
    return this.hasPermission('tournaments:progress-to-knockout');
  }

  canGenerateTournamentKnockoutBracket(): boolean {
    return this.hasPermission('tournaments:generate-knockout-bracket');
  }

  hasPermission(permission: AppPermission): boolean {
    return this.authStore.permissions().includes(permission);
  }

  roleLabels(): string[] {
    return this.authStore.roles().map((role) => role.replace(/_/g, ' '));
  }

  private permissionKey(resource: AuthorizationResource, action: AuthorizationAction): AppPermission {
    return `${resource}:${action}`;
  }
}
