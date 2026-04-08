import { expect, request, test } from '@playwright/test';

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:8080/api/';
const authStorageKey = 'championships.auth.session';

type AuthTokenResponse = {
  tokenType: string;
  authenticationScheme: string;
  sessionId: number | null;
  accessToken: string;
  accessTokenExpiresAt: string | null;
  refreshToken: string;
  refreshTokenExpiresAt: string | null;
};

type BackendAuthSession = {
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  authenticationScheme: string;
  sessionStrategy: string;
  sessionId: number | null;
  accessTokenExpiresAt: string | null;
  roles: string[];
  permissions: string[];
};

type ApiEnvelope<T> = {
  data: T;
};

type StoredAuthSession = BackendAuthSession & {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string | null;
  validatedAt: string;
};

async function buildStoredSession(username: string, password: string): Promise<StoredAuthSession> {
  const api = await request.newContext({ baseURL: apiBaseUrl });

  const loginResponse = await api.post('auth/login', {
    data: { username, password }
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginPayload = (await loginResponse.json()) as ApiEnvelope<AuthTokenResponse>;

  const sessionResponse = await api.get('auth/session', {
    headers: {
      Authorization: `Bearer ${loginPayload.data.accessToken}`
    }
  });
  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = (await sessionResponse.json()) as ApiEnvelope<BackendAuthSession>;

  await api.dispose();

  return {
    ...sessionPayload.data,
    tokenType: loginPayload.data.tokenType,
    accessToken: loginPayload.data.accessToken,
    refreshToken: loginPayload.data.refreshToken,
    refreshTokenExpiresAt: loginPayload.data.refreshTokenExpiresAt,
    validatedAt: new Date().toISOString()
  };
}

test.describe('dashboard governance visibility', () => {
  test('devadmin ve el bloque de gobierno operativo', async ({ page }) => {
    const storedSession = await buildStoredSession('devadmin', 'admin123');

    await page.addInitScript(
      ([storageKey, payload]) => window.localStorage.setItem(storageKey, payload),
      [authStorageKey, JSON.stringify(storedSession)] as const
    );

    await page.goto('/dashboard');

    await expect(page.getByText('Dashboard Ejecutivo')).toBeVisible();
    await expect(page.getByText('Actividad operativa reciente')).toBeVisible();
    await expect(page.getByText('Gobierno operativo de permisos')).toBeVisible();
    await expect(page.getByText('Roles gobernables')).toBeVisible();
    await expect(page.getByText('Editor controlado')).toBeVisible();
    await expect(page.getByText('Escritura habilitada en este ambiente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar permisos' }).first()).toBeVisible();
  });

  test('devoperator no ve el bloque de gobierno operativo', async ({ page }) => {
    const storedSession = await buildStoredSession('devoperator', 'admin123');

    await page.addInitScript(
      ([storageKey, payload]) => window.localStorage.setItem(storageKey, payload),
      [authStorageKey, JSON.stringify(storedSession)] as const
    );

    await page.goto('/dashboard');

    await expect(page.getByText('Dashboard Ejecutivo')).toBeVisible();
    await expect(page.getByText('Gobierno operativo de permisos')).toHaveCount(0);
    await expect(page.getByText('Actividad operativa reciente')).toHaveCount(0);
    await expect(page.getByText('Editor controlado')).toHaveCount(0);
  });
});
