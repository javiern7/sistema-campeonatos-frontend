import { Injectable, inject } from '@angular/core';

import { AppRole } from './auth.models';
import { AuthStore } from './auth.store';

export type AuthorizationResource =
  | 'teams'
  | 'players'
  | 'tournaments'
  | 'tournamentTeams'
  | 'tournamentStages'
  | 'stageGroups'
  | 'rosters'
  | 'matches';

export type AuthorizationAction = 'read' | 'manage' | 'delete';

interface ResourcePolicy {
  read: AppRole[];
  manage: AppRole[];
  delete: AppRole[];
}

const READONLY_ROLES: AppRole[] = ['AUTHENTICATED', 'TOURNAMENT_ADMIN', 'SUPER_ADMIN'];
const MANAGER_ROLES: AppRole[] = ['TOURNAMENT_ADMIN', 'SUPER_ADMIN'];
const SUPER_ADMIN_ROLES: AppRole[] = ['SUPER_ADMIN'];

const RESOURCE_POLICIES: Record<AuthorizationResource, ResourcePolicy> = {
  teams: { read: READONLY_ROLES, manage: MANAGER_ROLES, delete: SUPER_ADMIN_ROLES },
  players: { read: READONLY_ROLES, manage: MANAGER_ROLES, delete: SUPER_ADMIN_ROLES },
  tournaments: { read: READONLY_ROLES, manage: MANAGER_ROLES, delete: SUPER_ADMIN_ROLES },
  tournamentTeams: { read: READONLY_ROLES, manage: MANAGER_ROLES, delete: SUPER_ADMIN_ROLES },
  tournamentStages: { read: READONLY_ROLES, manage: MANAGER_ROLES, delete: SUPER_ADMIN_ROLES },
  stageGroups: { read: READONLY_ROLES, manage: MANAGER_ROLES, delete: SUPER_ADMIN_ROLES },
  rosters: { read: READONLY_ROLES, manage: MANAGER_ROLES, delete: SUPER_ADMIN_ROLES },
  matches: { read: READONLY_ROLES, manage: MANAGER_ROLES, delete: SUPER_ADMIN_ROLES }
};

@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly authStore = inject(AuthStore);

  canAccess(resource: AuthorizationResource, action: AuthorizationAction): boolean {
    const policy = RESOURCE_POLICIES[resource];

    return this.authStore.roles().some((role) => policy[action].includes(role));
  }

  canManage(resource: AuthorizationResource): boolean {
    return this.canAccess(resource, 'manage');
  }

  canDelete(resource: AuthorizationResource): boolean {
    return this.canAccess(resource, 'delete');
  }

  roleLabels(): string[] {
    return this.authStore.roles().map((role) => role.replace(/_/g, ' '));
  }
}
