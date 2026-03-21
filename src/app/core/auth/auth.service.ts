import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../api/api.models';
import { AuthSession } from './auth.models';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);

  login(username: string, password: string): Observable<void> {
    const basicToken = btoa(`${username}:${password}`);
    const headers = new HttpHeaders({ Authorization: `Basic ${basicToken}` });

    return this.http
      .get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/sports`, {
        headers,
        params: { activeOnly: 'true' }
      })
      .pipe(
        tap(() => this.authStore.setSession({ username, basicToken })),
        map(() => void 0)
      );
  }

  logout(): void {
    this.authStore.clear();
  }

  getSession(): AuthSession | null {
    return this.authStore.session();
  }
}
