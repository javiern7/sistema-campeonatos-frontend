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
  permissions: [
    'standings:read',
    'standings:manage',
    'standings:delete',
    'standings:recalculate',
    'tournaments:read',
    'tournamentStages:read',
    'stageGroups:read',
    'tournamentTeams:read',
    'teams:read',
    'rosters:read',
    'matches:read'
  ],
  tokenType: 'Bearer',
  accessToken: 'crud-token',
  refreshToken: 'crud-refresh',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  validatedAt: new Date().toISOString()
};

const tournaments = [
  {
    id: 7,
    name: 'Copa CRUD Operativa',
    description: 'Torneo de validacion CRUD',
    status: 'IN_PROGRESS',
    format: 'LEAGUE',
    active: true,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  }
];

const stages = [
  {
    id: 15,
    tournamentId: 7,
    name: 'Liga Regular',
    stageType: 'LEAGUE',
    sequenceOrder: 1,
    legs: 1,
    roundTrip: false,
    active: true,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  }
];

const groups = [
  {
    id: 22,
    stageId: 15,
    name: 'Grupo A',
    code: 'A',
    displayOrder: 1,
    qualifiedSlots: 2,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  }
];

const teams = [
  {
    id: 30,
    name: 'Equipo Norte',
    shortName: 'Norte',
    code: 'NOR',
    primaryColor: '#0a6e5a',
    secondaryColor: '#0e7490',
    active: true,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  }
];

const tournamentTeams = [
  {
    id: 40,
    tournamentId: 7,
    teamId: 30,
    registrationStatus: 'APPROVED',
    seedNumber: 1,
    groupDrawPosition: 1,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z'
  }
];

const standings = [
  {
    id: 51,
    tournamentId: 7,
    stageId: 15,
    groupId: 22,
    tournamentTeamId: 40,
    played: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    pointsFor: 3,
    pointsAgainst: 1,
    scoreDiff: 2,
    points: 3,
    rankPosition: 1,
    updatedAt: '2026-04-11T12:00:00Z'
  }
];

test.describe('CRUD operativo faltante V4 - standings', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${apiBaseUrl}/auth/session`, (route) =>
      route.fulfill({ json: apiEnvelope('AUTH_SESSION_FOUND', session) })
    );
    await page.route(`${apiBaseUrl}/tournaments**`, (route) => {
      if (route.request().url().includes('/operational-summary')) {
        return route.fulfill({ json: apiEnvelope('TOURNAMENT_OPERATIONAL_SUMMARY_PAGE', pageResponse([])) });
      }
      return route.fulfill({ json: apiEnvelope('TOURNAMENTS_FOUND', pageResponse(tournaments)) });
    });
    await page.route(`${apiBaseUrl}/tournament-stages**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_STAGES_FOUND', pageResponse(stages)) })
    );
    await page.route(`${apiBaseUrl}/stage-groups**`, (route) =>
      route.fulfill({ json: apiEnvelope('STAGE_GROUPS_FOUND', pageResponse(groups)) })
    );
    await page.route(`${apiBaseUrl}/teams**`, (route) =>
      route.fulfill({ json: apiEnvelope('TEAMS_FOUND', pageResponse(teams)) })
    );
    await page.route(`${apiBaseUrl}/tournament-teams**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_TEAMS_FOUND', pageResponse(tournamentTeams)) })
    );
    await page.route(`${apiBaseUrl}/rosters**`, (route) =>
      route.fulfill({ json: apiEnvelope('ROSTERS_FOUND', pageResponse([])) })
    );
    await page.route(`${apiBaseUrl}/matches**`, (route) =>
      route.fulfill({ json: apiEnvelope('MATCHES_FOUND', pageResponse([])) })
    );

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
  });

  test('lista standings y crea un registro con validaciones visibles', async ({ page }) => {
    let postedStanding: unknown = null;

    await page.route(`${apiBaseUrl}/standings**`, async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && request.url().endsWith('/standings')) {
        postedStanding = request.postDataJSON();
        return route.fulfill({ json: apiEnvelope('STANDING_CREATED', { id: 99, ...postedStanding }) });
      }
      return route.fulfill({ json: apiEnvelope('STANDING_PAGE', pageResponse(standings)) });
    });

    await page.goto('/standings');
    await expect(page.getByRole('heading', { name: 'Tabla de posiciones' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Equipo Norte \(#40\)/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo registro' })).toBeVisible();

    await page.getByRole('link', { name: 'Nuevo registro' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo standing' })).toBeVisible();

    await page.getByLabel('Jugados').fill('2');
    await page.getByLabel('Ganados').fill('1');
    await page.getByLabel('Empatados').fill('0');
    await page.getByLabel('Perdidos').fill('0');
    await expect(page.getByText('Ganados + empatados + perdidos debe ser igual')).toBeVisible();

    await page.getByLabel('Perdidos').fill('1');
    await page.getByLabel('Puntos a favor').fill('5');
    await page.getByLabel('Puntos en contra').fill('2');
    await page.getByLabel('Diferencia').fill('1');
    await expect(page.getByText('La diferencia debe ser puntos a favor menos puntos en contra.')).toBeVisible();

    await page.getByLabel('Diferencia').fill('3');
    await page.getByLabel('Puntos', { exact: true }).fill('3');
    await page.getByLabel('Posicion').fill('1');
    await page.getByRole('button', { name: 'Guardar' }).click();

    expect(postedStanding).toEqual({
      tournamentId: 7,
      stageId: null,
      groupId: null,
      tournamentTeamId: 40,
      played: 2,
      wins: 1,
      draws: 0,
      losses: 1,
      pointsFor: 5,
      pointsAgainst: 2,
      scoreDiff: 3,
      points: 3,
      rankPosition: 1
    });
  });
});
