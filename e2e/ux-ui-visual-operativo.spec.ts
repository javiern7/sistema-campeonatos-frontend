import { expect, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:8080/api';

const apiEnvelope = <T>(code: string, data: T) => ({
  success: true,
  code,
  message: code,
  data,
  timestamp: new Date().toISOString()
});

const pageResponse = <T>(content: T[]) => ({
  content,
  page: 0,
  number: 0,
  totalElements: content.length,
  totalPages: 1,
  size: 20,
  first: true,
  last: true
});

const session = {
  userId: 1,
  username: 'devadmin',
  email: 'devadmin@example.test',
  firstName: 'Dev',
  lastName: 'Admin',
  fullName: 'Dev Admin',
  authenticationScheme: 'BEARER',
  sessionStrategy: 'STATELESS',
  sessionId: null,
  accessTokenExpiresAt: '2099-01-01T00:00:00Z',
  roles: ['SUPER_ADMIN'],
  permissions: ['dashboard:read', 'teams:read', 'teams:manage', 'players:read', 'players:manage'],
  tokenType: 'Bearer',
  accessToken: 'visual-token',
  refreshToken: 'visual-refresh',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  validatedAt: new Date().toISOString()
};

const teams = [
  {
    id: 10,
    name: 'Club Norte Operativo',
    shortName: 'Norte',
    code: 'CNO',
    primaryColor: '#0a6e5a',
    secondaryColor: '#0e7490',
    active: true,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  },
  {
    id: 11,
    name: 'Academia Sur',
    shortName: null,
    code: 'ASU',
    primaryColor: null,
    secondaryColor: null,
    active: false,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  }
];

const players = [
  {
    id: 20,
    firstName: 'Lucia',
    lastName: 'Ramirez',
    documentType: 'DNI',
    documentNumber: '12345678',
    birthDate: '2002-03-02',
    email: 'lucia@example.test',
    phone: '999111222',
    active: true,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  },
  {
    id: 21,
    firstName: 'Mateo',
    lastName: 'Paz',
    documentType: null,
    documentNumber: null,
    birthDate: null,
    email: null,
    phone: null,
    active: true,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  }
];

test.describe('UX/UI visual operativo V4', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${apiBaseUrl}/auth/session`, (route) =>
      route.fulfill({ json: apiEnvelope('AUTH_SESSION_FOUND', session) })
    );
    await page.route(`${apiBaseUrl}/teams**`, (route) =>
      route.fulfill({ json: apiEnvelope('TEAMS_FOUND', pageResponse(teams)) })
    );
    await page.route(`${apiBaseUrl}/players**`, (route) =>
      route.fulfill({ json: apiEnvelope('PLAYERS_FOUND', pageResponse(players)) })
    );

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
  });

  test('mejora listados operativos de equipos y jugadores en desktop y mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/teams');

    await expect(page.getByRole('heading', { name: 'Equipos' })).toBeVisible();
    await expect(page.getByText('Con color maestro')).toBeVisible();
    await expect(page.getByText('Club Norte Operativo')).toBeVisible();
    await expect(page.getByText('Primario deterministico')).toBeVisible();

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(desktopOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/ux-ui-v4-teams-desktop.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/players');

    await expect(page.getByRole('heading', { name: 'Jugadores' })).toBeVisible();
    await expect(page.getByText('Con contacto')).toBeVisible();
    await expect(page.getByText('Lucia Ramirez')).toBeVisible();
    await expect(page.getByText('Email pendiente')).toBeVisible();

    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(mobileOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/ux-ui-v4-players-mobile.png', fullPage: true });
  });
});
