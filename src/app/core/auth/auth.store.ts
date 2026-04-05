import { Injectable, computed, signal } from '@angular/core';

import { AuthSession } from './auth.models';

const STORAGE_KEY = 'championships.auth.session';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly sessionState = signal<AuthSession | null>(this.readStorage());
  private readonly restoringState = signal(true);

  readonly session = computed(() => this.sessionState());
  readonly isRestoring = computed(() => this.restoringState());
  readonly isAuthenticated = computed(() => !!this.sessionState()?.accessToken);
  readonly username = computed(() => this.sessionState()?.username ?? '');
  readonly fullName = computed(() => this.sessionState()?.fullName ?? this.sessionState()?.username ?? '');
  readonly accessToken = computed(() => this.sessionState()?.accessToken ?? '');
  readonly refreshToken = computed(() => this.sessionState()?.refreshToken ?? '');
  readonly tokenType = computed(() => this.sessionState()?.tokenType ?? 'Bearer');
  readonly sessionId = computed(() => this.sessionState()?.sessionId ?? null);
  readonly accessTokenExpiresAt = computed(() => this.sessionState()?.accessTokenExpiresAt ?? null);
  readonly refreshTokenExpiresAt = computed(() => this.sessionState()?.refreshTokenExpiresAt ?? null);
  readonly roles = computed(() => this.sessionState()?.roles ?? []);
  readonly permissions = computed(() => this.sessionState()?.permissions ?? []);
  readonly authenticationScheme = computed(() => this.sessionState()?.authenticationScheme ?? 'BEARER');
  readonly sessionStrategy = computed(() => this.sessionState()?.sessionStrategy ?? 'STATELESS');

  setSession(session: AuthSession): void {
    this.sessionState.set(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  markRestoring(isRestoring: boolean): void {
    this.restoringState.set(isRestoring);
  }

  clear(): void {
    this.sessionState.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private readStorage(): AuthSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
