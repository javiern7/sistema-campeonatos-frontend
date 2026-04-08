import { expect, request, test } from '@playwright/test';

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:8080/api/';
const authStorageKey = 'championships.auth.session';
const tournamentId = 13;

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

test.describe('statistics basic cross validation', () => {
  test('devoperator visualiza resumen, grupo y knockout sin regresion visible', async ({ page }) => {
    const storedSession = await buildStoredSession('devoperator', 'admin123');

    await page.addInitScript(
      ([storageKey, payload]) => window.localStorage.setItem(storageKey, payload),
      [authStorageKey, JSON.stringify(storedSession)] as const
    );

    await page.goto(`/tournaments/${tournamentId}/statistics/basic`);

    await expect(page.getByText('Estadisticas basicas').first()).toBeVisible();
    await expect(page.getByText('Competencia Avanzada Y2625', { exact: true })).toBeVisible();
    await expect(page.getByText('Guardrail operativo')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lideres simples' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trazabilidad' })).toBeVisible();
    await expect(page.getByText('Dashboard').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver partidos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver standings' })).toBeVisible();
    await expect(page.getByText('Pendiente recalculo').first()).toBeVisible();
    await expect(page.getByText('No existen standings disponibles para resolver lideres en el scope solicitado')).toBeVisible();

    await page.screenshot({ path: '.codex-artifacts/validation/statistics-basic-tournament.png', fullPage: true });

    await page.getByRole('combobox', { name: 'Etapa' }).click();
    await page.getByRole('option', { name: 'Grupos Y2556' }).click();
    await page.getByRole('combobox', { name: 'Grupo' }).click();
    await page.getByRole('option', { name: 'Grupo A Y2556' }).click();
    await page.getByRole('button', { name: 'Actualizar lectura' }).click();

    await expect(page.getByText('Disponible').first()).toBeVisible();
    await expect(page.getByText('CA A Y2625').first()).toBeVisible();
    await expect(page.getByText('El scope solicitado corresponde a estadisticas por grupo')).toBeVisible();
    await expect(page.getByText('Activa').first()).toBeVisible();

    await page.screenshot({ path: '.codex-artifacts/validation/statistics-basic-group.png', fullPage: true });

    await page.getByRole('combobox', { name: 'Etapa' }).click();
    await page.getByRole('option', { name: 'Knockout Y2556' }).click();
    await page.getByRole('button', { name: 'Actualizar lectura' }).click();

    await expect(page.getByText('No aplicable').first()).toBeVisible();
    await expect(page.getByText('Los lideres de clasificacion no aplican a etapas KNOCKOUT')).toBeVisible();

    await page.screenshot({ path: '.codex-artifacts/validation/statistics-basic-knockout.png', fullPage: true });

    await page.getByRole('link', { name: 'Ver partidos' }).click();
    await expect(page).toHaveURL(/\/matches/);
    await expect(page.getByText('Partidos').first()).toBeVisible();

    await page.goBack();
    await expect(page.getByText('Estadisticas basicas').first()).toBeVisible();

    await page.getByRole('link', { name: 'Ver standings' }).click();
    await expect(page).toHaveURL(/\/standings/);
    await expect(page.getByText('Tabla de posiciones').first()).toBeVisible();
  });
});
