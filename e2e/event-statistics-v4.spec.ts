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
  permissions: ['matches:read', 'tournaments:read', 'teams:read', 'players:read', 'tournamentTeams:read'],
  tokenType: 'Bearer',
  accessToken: 'event-statistics-token',
  refreshToken: 'event-statistics-refresh',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  validatedAt: new Date().toISOString()
};

const tournament = {
  id: 7,
  sportId: 1,
  name: 'Copa Eventos',
  description: 'Torneo con eventos activos',
  seasonName: '2026',
  format: 'LEAGUE',
  status: 'IN_PROGRESS',
  startDate: '2026-04-01',
  endDate: null,
  createdAt: '2026-04-11T10:00:00Z',
  updatedAt: '2026-04-11T10:00:00Z'
};

const teams = [
  { id: 30, name: 'Equipo Norte', shortName: 'Norte', code: 'NOR', primaryColor: '#0a6e5a', secondaryColor: '#0e7490', active: true, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' },
  { id: 31, name: 'Equipo Sur', shortName: 'Sur', code: 'SUR', primaryColor: '#0e7490', secondaryColor: '#0a6e5a', active: true, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' }
];

const tournamentTeams = [
  { id: 40, tournamentId: 7, teamId: 30, registrationStatus: 'APPROVED', seedNumber: 1, groupDrawPosition: 1, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' },
  { id: 41, tournamentId: 7, teamId: 31, registrationStatus: 'APPROVED', seedNumber: 2, groupDrawPosition: 2, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' }
];

const players = [
  { id: 70, firstName: 'Ana', lastName: 'Gomez', documentType: null, documentNumber: null, birthDate: null, email: null, phone: null, active: true, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' },
  { id: 71, firstName: 'Lucia', lastName: 'Ramos', documentType: null, documentNumber: null, birthDate: null, email: null, phone: null, active: true, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' }
];

const matches = [
  {
    id: 90,
    tournamentId: 7,
    stageId: null,
    groupId: null,
    roundNumber: 1,
    matchdayNumber: 1,
    homeTournamentTeamId: 40,
    awayTournamentTeamId: 41,
    scheduledAt: '2026-04-12T20:00:00Z',
    venueName: 'Cancha Central',
    status: 'PLAYED',
    homeScore: 2,
    awayScore: 1,
    winnerTournamentTeamId: 40,
    notes: null,
    createdAt: '2026-04-12T10:00:00Z',
    updatedAt: '2026-04-12T10:00:00Z'
  }
];

const statistics = {
  tournamentId: 7,
  filters: { matchId: null, tournamentTeamId: null, teamId: null, playerId: null },
  summary: { goals: 3, yellowCards: 2, redCards: 1, activeEvents: 7 },
  players: [
    {
      playerId: 70,
      firstName: 'Ana',
      lastName: 'Gomez',
      displayName: 'Ana Gomez',
      tournamentTeamId: 40,
      teamId: 30,
      teamName: 'Equipo Norte',
      teamShortName: 'Norte',
      goals: 2,
      yellowCards: 1,
      redCards: 0,
      activeEvents: 4
    },
    {
      playerId: 71,
      firstName: 'Lucia',
      lastName: 'Ramos',
      displayName: 'Lucia Ramos',
      tournamentTeamId: 40,
      teamId: 30,
      teamName: 'Equipo Norte',
      teamShortName: 'Norte',
      goals: 0,
      yellowCards: 0,
      redCards: 1,
      activeEvents: 1
    }
  ],
  teams: [
    {
      tournamentTeamId: 40,
      teamId: 30,
      teamName: 'Equipo Norte',
      teamShortName: 'Norte',
      teamCode: 'NOR',
      seedNumber: 1,
      goals: 2,
      yellowCards: 1,
      redCards: 1,
      activeEvents: 5
    },
    {
      tournamentTeamId: 41,
      teamId: 31,
      teamName: 'Equipo Sur',
      teamShortName: 'Sur',
      teamCode: 'SUR',
      seedNumber: 2,
      goals: 1,
      yellowCards: 1,
      redCards: 0,
      activeEvents: 2
    }
  ],
  matches: [
    {
      matchId: 90,
      homeTournamentTeamId: 40,
      awayTournamentTeamId: 41,
      scheduledAt: '2026-04-12T20:00:00Z',
      goals: 3,
      yellowCards: 2,
      redCards: 1,
      activeEvents: 7
    }
  ],
  traceability: {
    derivedFromMatchEvents: true,
    source: 'match_event',
    includedEventTypes: ['SCORE', 'YELLOW_CARD', 'RED_CARD'],
    excludedStatuses: ['ANNULLED'],
    notes: ['Solo se agregan eventos con status ACTIVE']
  }
};

test.describe('Producto V4 - estadisticas derivadas de eventos', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${apiBaseUrl}/auth/session`, (route) =>
      route.fulfill({ json: apiEnvelope('AUTH_SESSION_FOUND', session) })
    );
    await page.route(`${apiBaseUrl}/tournaments/7`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_FOUND', tournament) })
    );
    await page.route(`${apiBaseUrl}/matches**`, (route) =>
      route.fulfill({ json: apiEnvelope('MATCHES_FOUND', pageResponse(matches)) })
    );
    await page.route(`${apiBaseUrl}/tournament-teams**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENT_TEAMS_FOUND', pageResponse(tournamentTeams)) })
    );
    await page.route(`${apiBaseUrl}/teams**`, (route) =>
      route.fulfill({ json: apiEnvelope('TEAMS_FOUND', pageResponse(teams)) })
    );
    await page.route(`${apiBaseUrl}/players**`, (route) =>
      route.fulfill({ json: apiEnvelope('PLAYERS_FOUND', pageResponse(players)) })
    );
    await page.route(`${apiBaseUrl}/tournaments/7/statistics/events**`, (route) =>
      route.fulfill({ json: apiEnvelope('EVENT_STATISTICS_FOUND', statistics) })
    );

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
  });

  test('muestra rankings, tarjetas, filtros y trazabilidad read-only', async ({ page }) => {
    await page.goto('/tournaments/7/statistics/events');

    await expect(page.getByRole('heading', { name: 'Estadisticas por eventos' })).toBeVisible();
    await expect(page.getByText('Copa Eventos', { exact: true })).toBeVisible();
    await expect(page.getByText('Eventos SCORE activos', { exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Ana Gomez' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: '2' }).first()).toBeVisible();
    await expect(page.getByText('Lucia Ramos')).toBeVisible();
    await expect(page.getByText('Fuente match_event')).toBeVisible();

    await page.getByLabel('Partido').click();
    await expect(page.getByRole('option', { name: /Equipo Norte/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.screenshot({ path: '.codex-artifacts/event-statistics-v4-desktop.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 860 });
    await expect(page.getByRole('heading', { name: 'Goleadores' })).toBeVisible();
    await page.screenshot({ path: '.codex-artifacts/event-statistics-v4-mobile.png', fullPage: true });
  });
});
