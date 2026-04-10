import { expect, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:8080/api';

const apiEnvelope = <T>(code: string, data: T) => ({
  success: true,
  code,
  message: code,
  data,
  timestamp: new Date().toISOString()
});

const publicHome = {
  portalName: 'Sistema Campeonatos',
  generatedAt: '2026-04-10T01:55:20.8761665-05:00',
  visibleTournamentCount: 2,
  liveTournamentCount: 1,
  upcomingTournamentCount: 1,
  completedTournamentCount: 0,
  featuredTournaments: [
    {
      id: 14,
      sportId: 1,
      sportName: 'Football',
      name: 'Disciplina HTTP F5470F',
      slug: 'disciplina-http-f5470f-2026-f5470f',
      seasonName: '2026-F5470F',
      format: 'LEAGUE',
      status: 'IN_PROGRESS',
      description: 'Validacion HTTP disciplina',
      startDate: '2026-04-01',
      endDate: '2026-06-30'
    }
  ],
  modules: {
    tournamentsEnabled: true,
    standingsEnabled: true,
    resultsEnabled: true,
    approvedPiecesEnabled: false
  }
};

const publicTournamentsPage = {
  content: [
    publicHome.featuredTournaments[0],
    {
      id: 13,
      sportId: 1,
      sportName: 'Football',
      name: 'Competencia Avanzada Y2625',
      slug: 'competencia-avanzada-y2625-2026-y2625',
      seasonName: '2026-Y2625',
      format: 'GROUPS_THEN_KNOCKOUT',
      status: 'OPEN',
      description: 'trace',
      startDate: '2026-05-01',
      endDate: '2026-07-30'
    }
  ],
  page: 0,
  size: 12,
  totalElements: 2,
  totalPages: 1,
  first: true,
  last: true
};

const publicTournamentDetail = {
  ...publicHome.featuredTournaments[0],
  updatedAt: '2026-04-09T01:07:13.91867Z',
  modules: publicHome.modules
};

const publicStandings = {
  tournamentId: 14,
  tournamentSlug: 'disciplina-http-f5470f-2026-f5470f',
  stageId: null,
  stageName: null,
  stageType: null,
  groupId: null,
  groupCode: null,
  groupName: null,
  totalEntries: 2,
  standings: [
    {
      position: 1,
      teamName: 'HTTP Team A F5470F',
      teamShortName: 'HTAF5470F',
      teamCode: 'HTAF5470F',
      played: 1,
      wins: 1,
      draws: 0,
      losses: 0,
      pointsFor: 2,
      pointsAgainst: 1,
      scoreDiff: 1,
      points: 3
    },
    {
      position: 2,
      teamName: 'HTTP Team B F5470F',
      teamShortName: 'HTBF5470F',
      teamCode: 'HTBF5470F',
      played: 1,
      wins: 0,
      draws: 0,
      losses: 1,
      pointsFor: 1,
      pointsAgainst: 2,
      scoreDiff: -1,
      points: 0
    }
  ]
};

const publicResults = {
  tournamentId: 14,
  tournamentSlug: 'disciplina-http-f5470f-2026-f5470f',
  stageId: null,
  groupId: null,
  totalClosedMatches: 1,
  results: [
    {
      match: {
        matchId: 14,
        stageId: 14,
        stageName: 'Liga F5470F',
        stageType: 'LEAGUE',
        groupId: null,
        groupCode: null,
        groupName: null,
        roundNumber: 1,
        matchdayNumber: 1,
        scheduledAt: null,
        venueName: null,
        status: 'PLAYED',
        homeScore: 2,
        awayScore: 1,
        homeTeam: {
          tournamentTeamId: 43,
          teamId: 50,
          teamName: 'HTTP Team A F5470F',
          shortName: 'HTAF5470F',
          code: 'HTAF5470F',
          seedNumber: 1
        },
        awayTeam: {
          tournamentTeamId: 44,
          teamId: 51,
          teamName: 'HTTP Team B F5470F',
          shortName: 'HTBF5470F',
          code: 'HTBF5470F',
          seedNumber: 2
        },
        winnerTeam: {
          tournamentTeamId: 43,
          teamId: 50,
          teamName: 'HTTP Team A F5470F',
          shortName: 'HTAF5470F',
          code: 'HTAF5470F',
          seedNumber: 1
        }
      },
      affectsStandings: true,
      standingScope: 'STAGE',
      standingStatus: 'PENDING_RECALCULATION'
    }
  ]
};

test.describe('portal publico minimo visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${apiBaseUrl}/public/home`, (route) =>
      route.fulfill({ json: apiEnvelope('PUBLIC_PORTAL_HOME_FOUND', publicHome) })
    );
    await page.route(`${apiBaseUrl}/public/tournaments**`, (route) =>
      route.fulfill({ json: apiEnvelope('PUBLIC_TOURNAMENT_PAGE', publicTournamentsPage) })
    );
    await page.route(`${apiBaseUrl}/public/tournaments/disciplina-http-f5470f-2026-f5470f`, (route) =>
      route.fulfill({ json: apiEnvelope('PUBLIC_TOURNAMENT_FOUND', publicTournamentDetail) })
    );
    await page.route(`${apiBaseUrl}/public/tournaments/disciplina-http-f5470f-2026-f5470f/standings`, (route) =>
      route.fulfill({ json: apiEnvelope('PUBLIC_TOURNAMENT_STANDINGS_FOUND', publicStandings) })
    );
    await page.route(`${apiBaseUrl}/public/tournaments/disciplina-http-f5470f-2026-f5470f/results`, (route) =>
      route.fulfill({ json: apiEnvelope('PUBLIC_TOURNAMENT_RESULTS_FOUND', publicResults) })
    );
  });

  test('renderiza home, listado y detalle publico sin tocar shell interno', async ({ page }) => {
    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: 'Sistema Campeonatos' })).toBeVisible();
    await expect(page.getByText('Piezas aprobadas: ocultas')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explorar torneos' })).toBeVisible();

    await page.goto('/portal/tournaments');

    await expect(page.getByRole('heading', { name: 'Torneos visibles' })).toBeVisible();
    await expect(page.getByText('Total visible: 2')).toBeVisible();
    await expect(page.getByText('Competencia Avanzada Y2625')).toBeVisible();

    await page.goto('/portal/tournaments/disciplina-http-f5470f-2026-f5470f');

    await expect(page.getByRole('heading', { name: 'Disciplina HTTP F5470F' })).toBeVisible();
    await expect(page.getByText('Tabla publica')).toBeVisible();
    await expect(page.locator('table').getByRole('cell', { name: /HTAF5470F/ }).first()).toBeVisible();
    await expect(page.getByText('Resultados publicados')).toBeVisible();
    await expect(page.getByText('Piezas aprobadas fuera de alcance')).toBeVisible();

    await page.screenshot({ path: '.codex-artifacts/validation/public-portal-minimum.png', fullPage: true });
  });
});
