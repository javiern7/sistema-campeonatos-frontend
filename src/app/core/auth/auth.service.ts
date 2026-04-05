import { HttpBackend, HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../api/api.models';
import {
  AuthLoginRequest,
  AuthRefreshRequest,
  AuthSession,
  AuthTokenResponse,
  BackendAuthSession
} from './auth.models';
import { AuthStore } from './auth.store';

const EXPIRY_SKEW_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authStore = inject(AuthStore);
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private refreshRequest$: Observable<void> | null = null;

  login(username: string, password: string): Observable<void> {
    const payload: AuthLoginRequest = { username, password };

    return this.rawHttp
      .post<ApiResponse<AuthTokenResponse>>(this.authUrl('/login'), payload)
      .pipe(
        map((response) => response.data),
        switchMap((tokens) => this.bootstrapFromTokens(tokens))
      );
  }

  restoreSession(): Observable<void> {
    this.authStore.markRestoring(true);

    const refreshToken = this.authStore.refreshToken();
    if (!refreshToken || this.isExpired(this.authStore.refreshTokenExpiresAt())) {
      this.authStore.clear();
      this.authStore.markRestoring(false);
      return of(void 0);
    }

    const restore$ = this.shouldRefreshAccessToken()
      ? this.refreshAccessToken()
      : this.fetchSession(this.authStore.accessToken(), this.currentTokens()).pipe(
          catchError((error: unknown) => {
            if (this.isUnauthorizedError(error)) {
              return this.refreshAccessToken();
            }

            return throwError(() => error);
          })
        );

    return restore$.pipe(
      catchError((error: unknown) => {
        if (this.isUnauthorizedError(error) || error instanceof HttpErrorResponse) {
          this.authStore.clear();
          return of(void 0);
        }

        return throwError(() => error);
      }),
      finalize(() => this.authStore.markRestoring(false))
    );
  }

  refreshAccessToken(): Observable<void> {
    const refreshToken = this.authStore.refreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const payload: AuthRefreshRequest = { refreshToken };
    this.refreshRequest$ = this.rawHttp
      .post<ApiResponse<AuthTokenResponse>>(this.authUrl('/refresh'), payload)
      .pipe(
        map((response) => response.data),
        switchMap((tokens) => this.bootstrapFromTokens(tokens)),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
        shareReplay(1)
      );

    return this.refreshRequest$;
  }

  logout(): Observable<void> {
    const accessToken = this.authStore.accessToken();

    if (!accessToken) {
      this.authStore.clear();
      return of(void 0);
    }

    return this.rawHttp
      .post<ApiResponse<void>>(this.authUrl('/logout'), null, {
        headers: this.buildBearerHeaders(accessToken)
      })
      .pipe(
        map(() => void 0),
        catchError(() => of(void 0)),
        tap(() => this.authStore.clear())
      );
  }

  forceClearSession(): void {
    this.authStore.clear();
  }

  getSession(): AuthSession | null {
    return this.authStore.session();
  }

  private bootstrapFromTokens(tokens: AuthTokenResponse): Observable<void> {
    return this.fetchSession(tokens.accessToken, tokens);
  }

  private fetchSession(accessToken: string, tokens: AuthTokenResponse): Observable<void> {
    return this.rawHttp
      .get<ApiResponse<BackendAuthSession>>(this.authUrl('/session'), {
        headers: this.buildBearerHeaders(accessToken)
      })
      .pipe(
        map((response) => response.data),
        tap((session) => this.authStore.setSession(this.mapSession(session, tokens))),
        map(() => void 0)
      );
  }

  private mapSession(session: BackendAuthSession, tokens: AuthTokenResponse): AuthSession {
    return {
      ...session,
      tokenType: tokens.tokenType || 'Bearer',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      validatedAt: new Date().toISOString()
    };
  }

  private currentTokens(): AuthTokenResponse {
    return {
      tokenType: this.authStore.tokenType(),
      authenticationScheme: this.authStore.authenticationScheme(),
      sessionId: this.authStore.sessionId(),
      accessToken: this.authStore.accessToken(),
      accessTokenExpiresAt: this.authStore.accessTokenExpiresAt(),
      refreshToken: this.authStore.refreshToken(),
      refreshTokenExpiresAt: this.authStore.refreshTokenExpiresAt()
    };
  }

  private buildBearerHeaders(accessToken: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
  }

  private shouldRefreshAccessToken(): boolean {
    const accessToken = this.authStore.accessToken();
    return !accessToken || this.isExpired(this.authStore.accessTokenExpiresAt(), EXPIRY_SKEW_MS);
  }

  private isExpired(value: string | null, skewMs = 0): boolean {
    if (!value) {
      return true;
    }

    const expiresAt = new Date(value).getTime();
    if (Number.isNaN(expiresAt)) {
      return true;
    }

    return expiresAt - skewMs <= Date.now();
  }

  private isUnauthorizedError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
  }

  private authUrl(path: string): string {
    return `${environment.apiBaseUrl}/auth/${path.replace(/^\/+/, '')}`;
  }
}
