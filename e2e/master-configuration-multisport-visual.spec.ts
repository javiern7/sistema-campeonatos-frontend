import { expect, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:8080/api';

const apiEnvelope = <T>(code: string, data: T) => ({
  success: true,
  code,
  message: code,
  data,
  timestamp: new Date().toISOString()
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
  permissions: [
    'dashboard:read',
    'sports:read',
    'configuration:basic:read',
    'configuration:basic:manage'
  ],
  tokenType: 'Bearer',
  accessToken: 'visual-token',
  refreshToken: 'visual-refresh',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  validatedAt: new Date().toISOString()
};

const sports = [
  {
    id: 1,
    code: 'FOOTBALL',
    name: 'Futbol',
    teamBased: true,
    maxPlayersOnField: 11,
    scoreLabel: 'Goles',
    active: true
  },
  {
    id: 2,
    code: 'BASKETBALL',
    name: 'Basquet',
    teamBased: true,
    maxPlayersOnField: 5,
    scoreLabel: 'Puntos',
    active: true
  }
];

const positions = [
  { id: 10, sportId: 1, code: 'GK', name: 'Arquero', displayOrder: 1, active: true },
  { id: 11, sportId: 1, code: 'FW', name: 'Delantero', displayOrder: 4, active: true }
];

const competitionFormats = [
  {
    code: 'LEAGUE',
    name: 'Liga',
    description: 'Todos contra todos con tabla acumulada.'
  },
  {
    code: 'GROUPS_THEN_KNOCKOUT',
    name: 'Grupos y eliminacion',
    description: 'Fase de grupos seguida por llaves.'
  },
  {
    code: 'KNOCKOUT',
    name: 'Eliminacion directa',
    description: 'Llaves de eliminacion hasta definir campeon.'
  }
];

test.describe('configuracion maestra multideporte visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${apiBaseUrl}/auth/session`, (route) =>
      route.fulfill({ json: apiEnvelope('AUTH_SESSION_FOUND', session) })
    );
    await page.route(`${apiBaseUrl}/sports/competition-formats`, (route) =>
      route.fulfill({ json: apiEnvelope('COMPETITION_FORMAT_LIST', competitionFormats) })
    );
    await page.route(`${apiBaseUrl}/sports/1/positions**`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        return route.fulfill({
          json: apiEnvelope('SPORT_POSITION_CREATED', { id: 12, sportId: 1, ...body })
        });
      }

      return route.fulfill({ json: apiEnvelope('SPORT_POSITION_LIST', positions) });
    });
    await page.route(`${apiBaseUrl}/sports**`, async (route) => {
      const url = route.request().url();
      if (url.includes('/competition-formats') || url.includes('/positions')) {
        return route.fallback();
      }

      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        return route.fulfill({
          json: apiEnvelope('SPORT_CREATED', { id: 3, ...body })
        });
      }

      return route.fulfill({ json: apiEnvelope('SPORT_LIST', sports) });
    });

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
  });

  test('permite revisar deportes, posiciones y formatos sin abrir modulos fuera del bloque', async ({ page }) => {
    await page.goto('/operations/master-configuration');

    await expect(page.getByRole('link', { name: 'Configuracion multideporte' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Configuracion multideporte' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Futbol' })).toBeVisible();
    await expect(page.getByText('Liga')).toBeVisible();
    await expect(page.getByText('Eliminacion directa')).toBeVisible();

    await page.getByRole('button', { name: 'Posiciones' }).first().click();
    await expect(page.getByRole('heading', { name: 'Posiciones de Futbol' })).toBeVisible();
    await expect(page.getByText('Arquero')).toBeVisible();
    await expect(page.getByText('Delantero')).toBeVisible();

    await page.getByLabel('Codigo').last().fill('MF');
    await page.getByLabel('Nombre').last().fill('Mediocampista');
    await page.getByLabel('Orden').fill('3');
    await page.getByRole('button', { name: 'Crear posicion' }).click();
    await expect(page.getByText('Posicion guardada correctamente')).toBeVisible();

    await page.screenshot({
      path: '.codex-artifacts/validation/master-configuration-multisport-page.png',
      fullPage: true
    });
  });
});
