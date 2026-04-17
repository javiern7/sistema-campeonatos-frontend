import { expect, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:8080/api';

const apiEnvelope = <T>(code: string, data: T, message = code) => ({
  success: true,
  code,
  message,
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
  permissions: ['tournaments:read', 'matches:read', 'standings:read', 'teams:read', 'players:read', 'tournamentTeams:read'],
  tokenType: 'Bearer',
  accessToken: 'reporting-token',
  refreshToken: 'reporting-refresh',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  validatedAt: new Date().toISOString()
};

const tournament = {
  id: 5,
  sportId: 1,
  name: 'Copa Reportes',
  description: 'Torneo con reporteria operativa',
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
  { id: 40, tournamentId: 5, teamId: 30, registrationStatus: 'APPROVED', seedNumber: 1, groupDrawPosition: 1, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' },
  { id: 41, tournamentId: 5, teamId: 31, registrationStatus: 'APPROVED', seedNumber: 2, groupDrawPosition: 2, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' }
];

const players = [
  { id: 70, firstName: 'Ana', lastName: 'Gomez', documentType: null, documentNumber: null, birthDate: null, email: null, phone: null, active: true, createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z' }
];

const matches = [
  {
    id: 90,
    tournamentId: 5,
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

const report = {
  metadata: {
    reportType: 'summary',
    generatedAt: '2026-04-16T09:30:00Z',
    source: 'operational_reporting'
  },
  tournament: { id: 5, name: 'Copa Reportes', seasonName: '2026' },
  filters: { tournamentId: 5 },
  totals: { matches: 1, goals: 3 },
  rows: [
    { report: 'Resumen', matches: 1, goals: 3, standingsSource: 'official_standings' },
    { report: 'Eventos', matches: 1, goals: 3, standingsSource: 'match_event' }
  ]
};

test.describe('Producto V4 - reporteria y exportacion', () => {
  test.beforeEach(async ({ page }) => {
    const capturedReportUrls: string[] = [];
    const capturedExportUrls: string[] = [];
    (page as unknown as { capturedReportUrls: string[] }).capturedReportUrls = capturedReportUrls;
    (page as unknown as { capturedExportUrls: string[] }).capturedExportUrls = capturedExportUrls;

    await page.route(`${apiBaseUrl}/auth/session`, (route) =>
      route.fulfill({ json: apiEnvelope('AUTH_SESSION_FOUND', session) })
    );
    await page.route(`${apiBaseUrl}/tournaments**`, (route) =>
      route.fulfill({ json: apiEnvelope('TOURNAMENTS_FOUND', pageResponse([tournament])) })
    );
    await page.route(`${apiBaseUrl}/tournaments/5`, (route) =>
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
    await page.route(`${apiBaseUrl}/tournaments/5/reports/export**`, (route) =>
      {
        capturedExportUrls.push(route.request().url());
        return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/csv;charset=UTF-8' },
        body: 'report,matches,goals\nResumen,1,3\n'
        });
      }
    );
    await page.route(`${apiBaseUrl}/tournaments/5/reports/**`, (route) =>
      {
        if (route.request().url().includes('/reports/export')) {
          return route.fallback();
        }
        capturedReportUrls.push(route.request().url());
        return route.fulfill({ json: apiEnvelope('REPORT_TOURNAMENT_SUMMARY_FOUND', report, 'Reporte generado correctamente') });
      }
    );

    await page.addInitScript(
      (payload) => window.localStorage.setItem('championships.auth.session', JSON.stringify(payload)),
      session
    );
  });

  test('muestra hub, filtros, trazabilidad, tabla y descarga simple', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/reporting');

    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByText('Entradas disponibles')).toBeVisible();
    await expect(page.getByRole('main').getByText('Tabla de posiciones')).toBeVisible();
    await page.getByRole('link', { name: 'Abrir reportes' }).click();

    await expect(page.getByRole('heading', { name: 'Reporteria y exportacion' })).toBeVisible();
    await expect(page.getByText('Copa Reportes', { exact: true })).toBeVisible();
    await expect(page.getByText('Fuente operational_reporting')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reportes disponibles' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'official_standings' })).toBeVisible();

    await page.getByLabel('Partido').click();
    await expect(page.getByRole('option', { name: /Equipo Norte/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByLabel('Desde').fill('2026-04-01');
    await page.getByLabel('Hasta').fill('2026-04-30');
    await page.getByRole('button', { name: 'Actualizar reporte' }).click();

    const capturedReportUrls = (page as unknown as { capturedReportUrls: string[] }).capturedReportUrls;
    await expect
      .poll(() => capturedReportUrls.some((url) => new URL(url).searchParams.get('scheduledFrom') === '2026-04-01T00:00:00-05:00'))
      .toBe(true);
    expect(capturedReportUrls.some((url) => new URL(url).searchParams.get('scheduledTo') === '2026-04-30T23:59:59-05:00')).toBe(true);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV' }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('torneo-5-summary.csv');
    const capturedExportUrls = (page as unknown as { capturedExportUrls: string[] }).capturedExportUrls;
    expect(capturedExportUrls.some((url) => new URL(url).searchParams.get('scheduledFrom') === '2026-04-01T00:00:00-05:00')).toBe(true);
    expect(capturedExportUrls.some((url) => new URL(url).searchParams.get('scheduledTo') === '2026-04-30T23:59:59-05:00')).toBe(true);

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(desktopOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/reporting-v4-desktop.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 860 });
    await expect(page.getByRole('heading', { name: 'Reporteria y exportacion' })).toBeVisible();
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(mobileOverflow).toBe(false);
    await page.screenshot({ path: '.codex-artifacts/reporting-v4-mobile.png', fullPage: true });
  });
});
