import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { NotificationService } from './notification.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const notifications = inject(NotificationService);
  const isAuthRequest = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
  const wasRetried = req.headers.has('X-Auth-Retry');

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 401 && !isAuthRequest && !wasRetried && authStore.refreshToken()) {
        return authService.refreshAccessToken().pipe(
          switchMap(() =>
            next(
              req.clone({
                setHeaders: {
                  Authorization: `Bearer ${authStore.accessToken()}`,
                  'X-Auth-Retry': '1'
                }
              })
            )
          ),
          catchError((refreshError: unknown) => {
            authService.forceClearSession();
            notifications.error('Tu sesion expiro y fue necesario volver a ingresar.');
            void router.navigateByUrl('/login');
            return throwError(() => refreshError);
          })
        );
      }

      if ((error.status === 401 || error.status === 403) && !isAuthRequest) {
        authService.forceClearSession();
        notifications.error(
          error.status === 401
            ? 'Tu sesion ya no es valida. Vuelve a iniciar sesion.'
            : 'No tienes permisos para realizar esta accion.'
        );
        void router.navigateByUrl('/login');
      }

      return throwError(() => error);
    })
  );
};
