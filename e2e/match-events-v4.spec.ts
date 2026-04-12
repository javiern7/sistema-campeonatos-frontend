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
  permissions: ['matches:read', 'matches:manage', 'tournamentTeams:read', 'teams:read', 'players:read', 'rosters:read'],
  tokenType: 'Bearer',
  accessToken: 'events-token',
  refreshToken: 'events-refresh',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  validatedAt: new Date().toISOString()
};

const match = {
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
  homeScore: 1,
  awayScore: 0,
  winnerTournamentTeamId: 40,
  notes: null,
  createdAt: '2026-04-12T10:00:00Z',
  updatedAt: '2026-04-12T10:00:00Z'
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

const rosters = [
  { id: 80, tournamentTeamId: 40, playerId: 70, jerseyNumber: 9, captain: false, positionName: 'Delantera', rosterStatus: 'ACTIVE', startDate: '2026-04-01', endDate: null, createdAt: '2026-04-11T10:00:00Z' },
  { id: 81, tournamentTeamId: 40, playerId: 71, jerseyNumber: 10, captain: false, positionName: 'Volante', rosterStatus: 'ACTIVE', startDate: '2026-04-01', endDate: null, createdAt: '2026-04-11T10:00:00Z' }
];

test.describe('Producto V4 - eventos detallados de partido', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${apiBaseUrl}/auth/session`, (route) =>
      route.fulfill({ json: apiEnvelope('AUTH_SESSION_FOUND', session) })
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
    await page.route(`${apiBaseUrl}/rosters**`, (route) =>
      route.fulfill({ json: apiEnvelope('ROSTERS_FOUND', pageResponse(rosters)) })
    );

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
  });

  test('lista, captura y anula eventos segun contrato backend', async ({ page }) => {
    let postedEvent: unknown = null;
    let annulPayload: unknown = null;
    const events = [
      {
        id: 501,
        matchId: 90,
        tournamentId: 7,
        eventType: 'SCORE',
        status: 'ACTIVE',
        tournamentTeamId: 40,
        playerId: 70,
        relatedPlayerId: null,
        periodLabel: '1T',
        eventMinute: 12,
        eventSecond: 30,
        eventValue: 1,
        notes: 'Anotacion simple',
        createdByUserId: 1,
        annulledByUserId: null,
        annulledAt: null,
        createdAt: '2026-04-12T20:12:30Z',
        updatedAt: '2026-04-12T20:12:30Z'
      }
    ];

    await page.route(`${apiBaseUrl}/matches/90/events/501`, async (route) => {
      const request = route.request();
      if (request.method() === 'DELETE') {
        annulPayload = request.postDataJSON();
        return route.fulfill({
          json: apiEnvelope('MATCH_EVENT_ANNULLED', { ...events[0], status: 'ANNULLED', annulledAt: '2026-04-12T21:00:00Z' })
        });
      }
      return route.fulfill({ json: apiEnvelope('MATCH_EVENT_UPDATED', events[0]) });
    });
    await page.route(`${apiBaseUrl}/matches/90/events`, async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        postedEvent = request.postDataJSON();
        return route.fulfill({ status: 201, json: apiEnvelope('MATCH_EVENT_CREATED', { id: 502, ...postedEvent }) });
      }
      return route.fulfill({ json: apiEnvelope('MATCH_EVENTS_FOUND', events) });
    });
    await page.route(`${apiBaseUrl}/matches/90`, (route) =>
      route.fulfill({ json: apiEnvelope('MATCH_FOUND', match) })
    );

    await page.goto('/matches/90/events');

    await expect(page.getByRole('heading', { name: 'Eventos del partido' })).toBeVisible();
    await expect(page.getByText('Equipo Norte (#40) vs Equipo Sur (#41)')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Anotacion Activo' })).toBeVisible();
    await page.screenshot({ path: '.codex-artifacts/match-events-v4.png', fullPage: true });

    await page.getByLabel('Equipo').click();
    await page.getByRole('option', { name: 'Equipo Norte (#40)' }).click();
    await page.getByLabel('Jugador', { exact: true }).click();
    await page.getByRole('option', { name: 'Ana Gomez' }).click();
    await page.getByLabel('Periodo').fill('2T');
    await page.getByLabel('Minuto').fill('55');
    await page.getByLabel('Valor').fill('1');
    await page.getByLabel('Notas').fill('Gol validado en cancha');
    await page.getByRole('button', { name: 'Registrar evento' }).click();

    expect(postedEvent).toEqual({
      eventType: 'SCORE',
      tournamentTeamId: 40,
      playerId: 70,
      relatedPlayerId: null,
      periodLabel: '2T',
      eventMinute: 55,
      eventSecond: null,
      eventValue: 1,
      notes: 'Gol validado en cancha'
    });

    page.once('dialog', async (dialog) => {
      await dialog.accept('Correccion de acta');
    });
    await page.getByRole('button', { name: 'Anular' }).click();
    expect(annulPayload).toEqual({ notes: 'Correccion de acta' });
  });
});
