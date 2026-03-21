import { Injectable, computed, signal } from '@angular/core';

import { AuthSession } from './auth.models';

const STORAGE_KEY = 'championships.auth.session';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly sessionState = signal<AuthSession | null>(this.readStorage());

  readonly session = computed(() => this.sessionState());
  readonly isAuthenticated = computed(() => !!this.sessionState()?.basicToken);
  readonly username = computed(() => this.sessionState()?.username ?? '');
  readonly basicToken = computed(() => this.sessionState()?.basicToken ?? '');

  setSession(session: AuthSession): void {
    this.sessionState.set(session);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  clear(): void {
    this.sessionState.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  private readStorage(): AuthSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
