import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { AuthorizationAction, AuthorizationResource, AuthorizationService } from './authorization.service';

interface AuthorizationGuardData {
  resource: AuthorizationResource;
  action: AuthorizationAction;
}

const ACCESS_FALLBACKS: Array<{ path: string; resource: AuthorizationResource }> = [
  { path: '/dashboard', resource: 'dashboard' },
  { path: '/operations/users', resource: 'users' },
  { path: '/operations/basic-configuration', resource: 'configuration:basic' },
  { path: '/sports', resource: 'sports' },
  { path: '/tournaments', resource: 'tournaments' },
  { path: '/tournament-teams', resource: 'tournamentTeams' },
  { path: '/tournament-stages', resource: 'tournamentStages' },
  { path: '/stage-groups', resource: 'stageGroups' },
  { path: '/teams', resource: 'teams' },
  { path: '/players', resource: 'players' },
  { path: '/rosters', resource: 'rosters' },
  { path: '/matches', resource: 'matches' },
  { path: '/standings', resource: 'standings' }
];

export const authorizationGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authorization = inject(AuthorizationService);
  const router = inject(Router);
  const data = route.data as AuthorizationGuardData;

  if (data.resource && data.action && authorization.canAccess(data.resource, data.action)) {
    return true;
  }

  const fallbackPath = ACCESS_FALLBACKS.find((item) => authorization.canRead(item.resource))?.path ?? '/login';
  return router.createUrlTree([fallbackPath]);
};
