import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { AuthorizationAction, AuthorizationResource, AuthorizationService } from './authorization.service';

interface AuthorizationGuardData {
  resource: AuthorizationResource;
  action: AuthorizationAction;
}

export const authorizationGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authorization = inject(AuthorizationService);
  const router = inject(Router);
  const data = route.data as AuthorizationGuardData;

  if (data.resource && data.action && authorization.canAccess(data.resource, data.action)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
