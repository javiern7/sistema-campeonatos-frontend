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
  accessToken: 'fase-a-demo-token',
  refreshToken: 'fase-a-demo-refresh',
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
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-04-18T10:00:00Z'
  },
  {
    id: 2,
    name: 'Academia Sur Demo',
    shortName: 'Sur',
    code: 'ASU',
    primaryColor: '#6d5bd0',
    secondaryColor: '#b7791f',
    active: true,
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-04-18T10:00:00Z'
  }
];
const players = [
  {
    id: 10,
    firstName: 'Ariel',
    lastName: 'Rojas',
    documentType: 'DNI',
    documentNumber: '10000010',
    birthDate: '1999-01-10',
    active: true,
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-04-18T10:00:00Z'
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
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-04-18T10:00:00Z'
  }
];
const stages = [{ id: 200, tournamentId: 100, name: 'Fase regular', stageType: 'LEAGUE', sortOrder: 1, active: true }];
const groups = [{ id: 300, stageId: 200, name: 'Grupo unico', sortOrder: 1, active: true }];
const registrations = [
  { id: 400, tournamentId: 100, teamId: 1, registrationStatus: 'APPROVED', seedNumber: 1, active: true },
  { id: 401, tournamentId: 100, teamId: 2, registrationStatus: 'APPROVED', seedNumber: 2, active: true }
];
const rosters = [
  {
    id: 700,
    tournamentTeamId: 400,
    playerId: 10,
    jerseyNumber: 9,
    rosterStatus: 'ACTIVE',
    active: true,
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-04-18T10:00:00Z'
  }
];
const matches = [
  {
    id: 500,
    tournamentId: 100,
    stageId: 200,
    groupId: 300,
    roundNumber: 1,
    matchdayNumber: 1,
    homeTournamentTeamId: 400,
    awayTournamentTeamId: 401,
    scheduledAt: '2026-04-18T20:00:00Z',
    venueName: 'Cancha central',
    status: 'PLAYED',
    homeScore: 2,
    awayScore: 1,
    winnerTournamentTeamId: 400,
    notes: null,
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-04-18T22:00:00Z'
  }
];
const standings = [
  {
    id: 600,
    tournamentId: 100,
    stageId: 200,
    groupId: 300,
    tournamentTeamId: 400,
    played: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    pointsFor: 2,
    pointsAgainst: 1,
    scoreDiff: 1,
    points: 3,
    rankPosition: 1,
    updatedAt: '2026-04-18T22:00:00Z'
  }
];
const eventStatistics = {
  tournamentId: 100,
  filters: { matchId: null, tournamentTeamId: null, teamId: null, playerId: null },
  summary: { goals: 2, yellowCards: 1, redCards: 0, activeEvents: 3 },
  players: [
    {
      playerId: 10,
      firstName: 'Ariel',
      lastName: 'Rojas',
      displayName: 'Ariel Rojas',
      tournamentTeamId: 400,
      teamId: 1,
      teamName: 'Club Norte Operativo',
      teamShortName: 'Norte',
      goals: 2,
      yellowCards: 1,
      redCards: 0,
      activeEvents: 3
    }
  ],
  teams: [
    {
      tournamentTeamId: 400,
      teamId: 1,
      teamName: 'Club Norte Operativo',
      teamShortName: 'Norte',
      teamCode: 'CNO',
      seedNumber: 1,
      goals: 2,
      yellowCards: 1,
      redCards: 0,
      activeEvents: 3
    }
  ],
  matches: [
    {
      matchId: 500,
      homeTournamentTeamId: 400,
      awayTournamentTeamId: 401,
      scheduledAt: '2026-04-18T20:00:00Z',
      goals: 2,
      yellowCards: 1,
      redCards: 0,
      activeEvents: 3
    }
  ],
  traceability: {
    derivedFromMatchEvents: true,
    source: 'match_event',
    includedEventTypes: ['SCORE', 'YELLOW_CARD', 'RED_CARD'],
    excludedStatuses: ['ANNULLED']
  }
};
const report = {
  tournamentId: 100,
  reportType: 'summary',
  filters: {},
  rows: [{ torneo: 'Liga Demo Operativa', partidos: 1, goles: 3 }],
  totals: { partidos: 1, goles: 3 },
  metadata: { source: 'backend reports', generatedAt: '2026-04-18T22:15:00Z' }
};

test.describe('Fase A assets locales y validacion demo', () => {
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
      route.fulfill({ json: apiEnvelope('PLAYERS_FOUND', pageResponse(players)) })
    );
    await page.route(`${apiBaseUrl}/rosters**`, (route) =>
      route.fulfill({ json: apiEnvelope('ROSTERS_FOUND', pageResponse(rosters)) })
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
    await page.route(`${apiBaseUrl}/tournaments/operational-summary**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_OPERATIONAL_SUMMARIES_FOUND', pageResponse([])) })
    );
    await page.route(`${apiBaseUrl}/tournaments/100/statistics/events**`, (route) =>
      route.fulfill({ json: apiEnvelope('EVENT_STATISTICS_FOUND', eventStatistics) })
    );
    await page.route(`${apiBaseUrl}/tournaments/100/reports**`, (route) =>
      route.fulfill({ json: apiEnvelope('REPORT_FOUND', report) })
    );
    await page.route(`${apiBaseUrl}/tournaments/100`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_FOUND', tournaments[0]) })
    );
    await page.route(`${apiBaseUrl}/tournaments**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENTS_FOUND', pageResponse(tournaments)) })
    );
  });

  test('login usa asset local y no depende de imagen remota critica', async ({ page }) => {
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Ingreso operativo' })).toBeVisible();
    await expect(page.getByText('Operacion lista para demo')).toBeVisible();
    await expect(page.getByLabel('Usuario')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    await expect(page.locator('.login-visual')).toHaveCSS(
      'background-image',
      /login-demo-sports\.svg/
    );
    expect(requestedUrls.some((url) => url.includes('images.unsplash.com'))).toBe(false);
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/fase-a-login-desktop.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ingreso operativo' })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/fase-a-login-mobile.png', fullPage: true });
  });

  test('rutas principales de demo renderizan sin overflow desktop/mobile', async ({ page }) => {
    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );

    const desktopRoutes = [
      { path: '/dashboard', heading: 'Dashboard', screenshot: 'fase-a-dashboard-desktop.png' },
      { path: '/tournaments', heading: 'Torneos', screenshot: 'fase-a-torneos-desktop.png' },
      { path: '/matches', heading: 'Partidos', screenshot: 'fase-a-partidos-desktop.png' },
      { path: '/standings', heading: 'Tabla de posiciones', screenshot: 'fase-a-standings-desktop.png' },
      {
        path: '/tournaments/100/statistics/events',
        heading: 'Estadisticas por eventos',
        screenshot: 'fase-a-estadisticas-desktop.png'
      },
      { path: '/reporting', heading: 'Reportes', screenshot: 'fase-a-reportes-desktop.png' }
    ];

    await page.setViewportSize({ width: 1366, height: 768 });
    for (const route of desktopRoutes) {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);
      await page.screenshot({ path: `.codex-artifacts/validation/${route.screenshot}`, fullPage: true });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Navegacion' })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/fase-a-dashboard-mobile.png', fullPage: true });

    await page.goto('/matches');
    await expect(page.getByRole('heading', { name: 'Partidos' })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/validation/fase-a-partidos-mobile.png', fullPage: true });
  });
});

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}
