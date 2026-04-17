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
    'sports:read',
    'teams:read',
    'players:read',
    'tournaments:read',
    'tournamentTeams:read',
    'tournamentStages:read',
    'stageGroups:read',
    'rosters:read',
    'matches:read',
    'standings:read'
  ],
  tokenType: 'Bearer',
  accessToken: 'post-v4-token',
  refreshToken: 'post-v4-refresh',
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
    createdAt: '2026-04-16T10:00:00Z',
    updatedAt: '2026-04-16T10:00:00Z'
  },
  {
    id: 2,
    name: 'Academia Sur',
    shortName: 'Sur',
    code: 'ASU',
    primaryColor: '#6d5bd0',
    secondaryColor: '#b7791f',
    active: true,
    createdAt: '2026-04-16T10:00:00Z',
    updatedAt: '2026-04-16T10:00:00Z'
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
    createdAt: '2026-04-16T10:00:00Z',
    updatedAt: '2026-04-16T10:00:00Z'
  }
];
const stages = [{ id: 200, tournamentId: 100, name: 'Fase regular', stageType: 'LEAGUE', sortOrder: 1, active: true }];
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
    scheduledAt: '2026-04-16T20:00:00Z',
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
  },
  {
    id: 601,
    tournamentId: 100,
    stageId: 200,
    groupId: 300,
    tournamentTeamId: 401,
    rankPosition: 2,
    played: 1,
    won: 0,
    drawn: 0,
    lost: 1,
    goalsFor: 1,
    goalsAgainst: 2,
    goalDifference: -1,
    points: 0
  }
];
const operationalSummaries = [
  {
    tournamentId: 100,
    approvedTeams: 2,
    approvedTeamsWithActiveRosterSupport: 2,
    approvedTeamsMissingActiveRosterSupport: 0,
    closedMatches: 1,
    generatedStandings: 2,
    operationalCategory: 'PRODUCTION',
    executiveReportingEligible: true,
    integrityHealthy: true,
    integrityAlerts: []
  }
];

test.describe('Post V4 pulido demo operativo', () => {
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
      route.fulfill({ json: apiEnvelope('TOURNAMENT_OPERATIONAL_SUMMARIES_FOUND', pageResponse(operationalSummaries)) })
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

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
  });

  test('mantiene shell demostrable sin overflow en desktop y mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard Ejecutivo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Torneos' })).toBeVisible();
    await expect(page.getByText('Liga Demo Operativa').first()).toBeVisible();
    await expect(page.getByText('Flujo listo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Navegacion' })).toHaveCount(0);

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(desktopOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/post-v4-demo-dashboard-desktop.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard Ejecutivo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Navegacion' })).toBeVisible();
    await page.getByRole('button', { name: 'Navegacion' }).click();
    await expect(page.getByRole('link', { name: 'Partidos' })).toBeVisible();

    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(mobileOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/post-v4-demo-dashboard-mobile.png', fullPage: true });
  });
});
