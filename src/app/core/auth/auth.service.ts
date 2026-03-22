import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../api/api.models';
import { AppPermission, AppRole, AuthSession, AuthorizationProfile, BackendAuthSession } from './auth.models';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);

  login(username: string, password: string): Observable<void> {
    const basicToken = btoa(`${username}:${password}`);
    return this.resolveSession(basicToken, username);
  }

  restoreSession(): Observable<void> {
    const session = this.authStore.session();

    if (!session?.basicToken) {
      return of(void 0);
    }

    return this.resolveSession(session.basicToken, session.username).pipe(
      catchError((error: unknown) => {
        if (this.isUnauthorizedError(error)) {
          this.authStore.clear();
        }

        return of(void 0);
      })
    );
  }

  logout(): void {
    this.authStore.clear();
  }

  getSession(): AuthSession | null {
    return this.authStore.session();
  }

  private resolveSession(basicToken: string, username: string): Observable<void> {
    const headers = new HttpHeaders({ Authorization: `Basic ${basicToken}` });
    const authContract = environment.authContract;

    return this.http
      .get<ApiResponse<BackendAuthSession>>(`${environment.apiBaseUrl}/${authContract.sessionPath.replace(/^\/+/, '')}`, {
        headers
      })
      .pipe(
        map((response) => response.data),
        tap((session) => this.authStore.setSession(this.mapBackendSession(session, basicToken))),
        map(() => void 0),
        catchError((error: unknown) => this.tryTemporaryFallback(error, headers, username, basicToken))
      );
  }

  private tryTemporaryFallback(
    error: unknown,
    headers: HttpHeaders,
    username: string,
    basicToken: string
  ): Observable<void> {
    const authContract = environment.authContract;

    if (!authContract.allowTemporaryProfileFallback || !this.isMissingSessionContractError(error)) {
      return throwError(() => error);
    }

    return this.http
      .get<ApiResponse<unknown>>(
        `${environment.apiBaseUrl}/${authContract.fallbackValidationPath.replace(/^\/+/, '')}`,
        {
          headers,
          params: authContract.fallbackValidationQuery as Record<string, string | number | boolean>
        }
      )
      .pipe(
        tap(() =>
          this.authStore.setSession({
            username,
            basicToken,
            roles: this.resolveRoles(username),
            permissions: this.resolvePermissions(username),
            authorizationSource: 'temporary-profile',
            validatedAt: new Date().toISOString()
          })
        ),
        map(() => void 0)
      );
  }

  private resolveRoles(username: string): AppRole[] {
    const normalizedUsername = username.trim().toLowerCase();
    const matchedProfile = environment.authContract.roleProfiles.find((profile: AuthorizationProfile) =>
      profile.usernames.some((candidate: string) => candidate.trim().toLowerCase() === normalizedUsername)
    );

    return Array.from(new Set([...(environment.authContract.defaultRoles ?? []), ...(matchedProfile?.roles ?? [])]));
  }

  private resolvePermissions(username: string): AppPermission[] {
    const roles = this.resolveRoles(username);
    const permissions = new Set<AppPermission>();
    const readableResources = [
      'dashboard',
      'sports',
      'teams',
      'players',
      'tournaments',
      'tournamentTeams',
      'tournamentStages',
      'stageGroups',
      'rosters',
      'matches',
      'standings'
    ] as const;
    const writableResources = [
      'teams',
      'players',
      'tournaments',
      'tournamentTeams',
      'tournamentStages',
      'stageGroups',
      'rosters',
      'matches',
      'standings'
    ] as const;

    readableResources.forEach((resource) => permissions.add(`${resource}:read`));

    if (roles.includes('SUPER_ADMIN') || roles.includes('TOURNAMENT_ADMIN')) {
      writableResources.forEach((resource) => permissions.add(`${resource}:manage`));
    }

    if (roles.includes('SUPER_ADMIN')) {
      writableResources.forEach((resource) => permissions.add(`${resource}:delete`));
    }

    return Array.from(permissions).sort();
  }

  private mapBackendSession(session: BackendAuthSession, basicToken: string): AuthSession {
    return {
      ...session,
      basicToken,
      authorizationSource: 'backend-session',
      validatedAt: new Date().toISOString()
    };
  }

  private isMissingSessionContractError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 404;
  }

  private isUnauthorizedError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
  }
}
