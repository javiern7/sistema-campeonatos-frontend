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
  username: 'demo.admin',
  email: 'demo.admin@example.test',
  firstName: 'Demo',
  lastName: 'Admin',
  fullName: 'Demo Admin',
  authenticationScheme: 'BEARER',
  sessionStrategy: 'STATELESS',
  sessionId: null,
  accessTokenExpiresAt: '2099-01-01T00:00:00Z',
  roles: ['SUPER_ADMIN'],
  permissions: [
    'dashboard:read',
    'configuration:basic:read',
    'configuration:basic:manage',
    'sports:read',
    'teams:read',
    'players:read',
    'tournaments:read',
    'tournamentTeams:read',
    'tournamentStages:read',
    'stageGroups:read',
    'rosters:read',
    'matches:read',
    'matches:manage',
    'standings:read'
  ],
  tokenType: 'Bearer',
  accessToken: 'post-v4-visual-token',
  refreshToken: 'post-v4-visual-refresh',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  validatedAt: new Date().toISOString()
};

const sports = [{ id: 1, code: 'FUT', name: 'Futbol', active: true }];
const teams = [
  {
    id: 1,
    name: 'Club Norte Operativo',
    shortName: 'Norte',
    code: 'CNO',
    primaryColor: '#0a6e5a',
    secondaryColor: '#0e7490',
    active: true,
    createdAt: '2026-04-17T10:00:00Z',
    updatedAt: '2026-04-17T10:00:00Z'
  },
  {
    id: 2,
    name: 'Academia Sur Demo',
    shortName: 'Sur',
    code: 'ASU',
    primaryColor: '#6d5bd0',
    secondaryColor: '#b7791f',
    active: true,
    createdAt: '2026-04-17T10:00:00Z',
    updatedAt: '2026-04-17T10:00:00Z'
  }
];
const tournaments = [
  {
    id: 100,
    name: 'Liga Demo Operativa',
    slug: 'liga-demo-operativa',
    description: 'Torneo listo para demostracion operativa.',
    sportId: 1,
    seasonName: '2026',
    status: 'IN_PROGRESS',
    operationalCategory: 'PRODUCTION',
    executiveReportingEligible: true,
    active: true,
    createdAt: '2026-04-17T10:00:00Z',
    updatedAt: '2026-04-17T10:00:00Z'
  },
  {
    id: 101,
    name: 'Copa Apertura Norte',
    slug: 'copa-apertura-norte',
    description: 'Segundo torneo para revisar filtros.',
    sportId: 1,
    seasonName: '2026',
    status: 'OPEN',
    operationalCategory: 'PRODUCTION',
    executiveReportingEligible: true,
    active: true,
    createdAt: '2026-04-17T10:00:00Z',
    updatedAt: '2026-04-17T10:00:00Z'
  }
];
const stages = [
  { id: 200, tournamentId: 100, name: 'Fase regular', stageType: 'LEAGUE', sortOrder: 1, active: true },
  { id: 201, tournamentId: 101, name: 'Clasificacion', stageType: 'LEAGUE', sortOrder: 1, active: true }
];
const groups = [{ id: 300, stageId: 200, name: 'Grupo unico', sortOrder: 1, active: true }];
const registrations = [
  { id: 400, tournamentId: 100, teamId: 1, registrationStatus: 'APPROVED', seedNumber: 1, active: true },
  { id: 401, tournamentId: 100, teamId: 2, registrationStatus: 'APPROVED', seedNumber: 2, active: true }
];
const matches = [
  {
    id: 500,
    tournamentId: 100,
    stageId: 200,
    groupId: 300,
    homeTournamentTeamId: 400,
    awayTournamentTeamId: 401,
    scheduledAt: '2026-04-17T20:00:00Z',
    venueName: 'Cancha central',
    roundNumber: 1,
    matchdayNumber: 1,
    status: 'PLAYED',
    homeScore: 2,
    awayScore: 1,
    winnerTournamentTeamId: 400
  }
];
const standings = [
  {
    id: 600,
    tournamentId: 100,
    stageId: 200,
    groupId: 300,
    tournamentTeamId: 400,
    rankPosition: 1,
    played: 1,
    won: 1,
    drawn: 0,
    lost: 0,
    goalsFor: 2,
    goalsAgainst: 1,
    goalDifference: 1,
    points: 3
  }
];
const basicConfiguration = {
  organizationName: 'Sistema Campeonatos Demo',
  supportEmail: 'soporte@example.test',
  defaultTimezone: 'America/Lima',
  updatedAt: '2026-04-17T02:00:00Z'
};

test.describe('Post V4 pulido visual demo II', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${apiBaseUrl}/auth/session`, (route) =>
      route.fulfill({ json: apiEnvelope('AUTH_SESSION_FOUND', session) })
    );
    await page.route(`${apiBaseUrl}/sports**`, (route) =>
      route.fulfill({ json: apiEnvelope('SPORTS_FOUND', sports) })
    );
    await page.route(`${apiBaseUrl}/teams**`, (route) =>
      route.fulfill({ json: apiEnvelope('TEAMS_FOUND', pageResponse(teams)) })
    );
    await page.route(`${apiBaseUrl}/players**`, (route) =>
      route.fulfill({ json: apiEnvelope('PLAYERS_FOUND', pageResponse([])) })
    );
    await page.route(`${apiBaseUrl}/tournaments/operational-summaries**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_OPERATIONAL_SUMMARIES_FOUND', pageResponse([])) })
    );
    await page.route(`${apiBaseUrl}/tournaments**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENTS_FOUND', pageResponse(tournaments)) })
    );
    await page.route(`${apiBaseUrl}/tournament-stages**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_STAGES_FOUND', pageResponse(stages)) })
    );
    await page.route(`${apiBaseUrl}/stage-groups**`, (route) =>
      route.fulfill({ json: apiEnvelope('STAGE_GROUPS_FOUND', pageResponse(groups)) })
    );
    await page.route(`${apiBaseUrl}/tournament-teams**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_TEAMS_FOUND', pageResponse(registrations)) })
    );
    await page.route(`${apiBaseUrl}/matches**`, (route) =>
      route.fulfill({ json: apiEnvelope('MATCHES_FOUND', pageResponse(matches)) })
    );
    await page.route(`${apiBaseUrl}/standings**`, (route) =>
      route.fulfill({ json: apiEnvelope('STANDINGS_FOUND', pageResponse(standings)) })
    );
    await page.route(`${apiBaseUrl}/operations/basic-configuration`, (route) =>
      route.fulfill({ json: apiEnvelope('BASIC_CONFIGURATION_FOUND', basicConfiguration) })
    );
  });

  test('moderniza login y filtros operativos sin overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Ingreso operativo' })).toBeVisible();
    await expect(page.getByText('Operacion lista para demo')).toBeVisible();
    await expect(page.getByLabel('Usuario')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();

    const loginOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(loginOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/post-v4-visual-ii-login-desktop.png', fullPage: true });

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
    await page.goto('/matches');

    await expect(page.getByRole('heading', { name: 'Partidos' })).toBeVisible();
    await expect(page.getByText('Total filtrado: 1 partidos')).toBeVisible();
    await page.getByLabel('Torneo').click();
    await expect(page.getByRole('option', { name: 'Liga Demo Operativa' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Copa Apertura Norte' })).toBeVisible();

    const selectPanelBackground = await page.locator('.mat-mdc-select-panel').evaluate((node) => {
      return window.getComputedStyle(node).backgroundColor;
    });
    expect(selectPanelBackground).toBe('rgb(255, 255, 255)');

    const matchesOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(matchesOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/post-v4-visual-ii-matches-filter-desktop.png', fullPage: true });
  });

  test('mantiene login mobile y aclara configuracion basica', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Ingreso operativo' })).toBeVisible();
    await expect(page.getByText('Token Bearer y permisos efectivos')).toBeVisible();

    const mobileLoginOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(mobileLoginOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/post-v4-visual-ii-login-mobile.png', fullPage: true });

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
    await page.goto('/operations/basic-configuration');

    await expect(page.getByRole('heading', { name: 'Configuracion basica' })).toBeVisible();
    await expect(page.getByText('Identidad operativa del sistema')).toBeVisible();
    await expect(page.getByText('Reconocimiento interno')).toBeVisible();
    await expect(page.getByText('Punto de contacto')).toBeVisible();
    await expect(page.getByText('Referencia horaria')).toBeVisible();

    const configurationOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(configurationOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/post-v4-visual-ii-basic-configuration-mobile.png', fullPage: true });
  });
});
