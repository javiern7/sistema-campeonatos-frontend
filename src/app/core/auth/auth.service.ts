import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../api/api.models';
import { AppRole, AuthSession, AuthorizationProfile } from './auth.models';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);

  login(username: string, password: string): Observable<void> {
    const basicToken = btoa(`${username}:${password}`);
    const headers = new HttpHeaders({ Authorization: `Basic ${basicToken}` });
    const authContract = environment.authContract;

    return this.http
      .get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/${authContract.validationPath.replace(/^\/+/, '')}`, {
        headers,
        params: authContract.validationQuery as Record<string, string | number | boolean>
      })
      .pipe(
        tap(() =>
          this.authStore.setSession({
            username,
            basicToken,
            roles: this.resolveRoles(username),
            authorizationSource: authContract.authorizationSource,
            validatedAt: new Date().toISOString()
          })
        ),
        map(() => void 0)
      );
  }

  logout(): void {
    this.authStore.clear();
  }

  getSession(): AuthSession | null {
    return this.authStore.session();
  }

  private resolveRoles(username: string): AppRole[] {
    const normalizedUsername = username.trim().toLowerCase();
    const matchedProfile = environment.authContract.roleProfiles.find((profile: AuthorizationProfile) =>
      profile.usernames.some((candidate: string) => candidate.trim().toLowerCase() === normalizedUsername)
    );

    return Array.from(new Set([...(environment.authContract.defaultRoles ?? []), ...(matchedProfile?.roles ?? [])]));
  }
}
