import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { authorizationGuard } from './core/auth/authorization.guard';

export const appRoutes: Routes = [
  {
    path: 'portal',
    loadComponent: () => import('./layout/public-shell/public-shell.component').then((m) => m.PublicShellComponent),
    children: [
      {
        path: '',
        title: 'Portal publico',
        loadComponent: () =>
          import('./features/public-portal/public-home-page.component').then((m) => m.PublicHomePageComponent)
      },
      {
        path: 'tournaments',
        title: 'Torneos publicos',
        loadComponent: () =>
          import('./features/public-portal/public-tournament-list-page.component').then(
            (m) => m.PublicTournamentListPageComponent
          )
      },
      {
        path: 'tournaments/:slug',
        title: 'Detalle publico de torneo',
        loadComponent: () =>
          import('./features/public-portal/public-tournament-detail-page.component').then(
            (m) => m.PublicTournamentDetailPageComponent
          )
      }
    ]
  },
  {
    path: 'login',
    title: 'Login',
    loadComponent: () =>
      import('./features/auth/login-page.component').then((m) => m.LoginPageComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        canActivate: [authorizationGuard],
        data: { resource: 'dashboard', action: 'read' },
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent)
      },
      {
        path: 'operations/users',
        title: 'Usuarios operativos',
        canActivate: [authorizationGuard],
        data: { resource: 'users', action: 'read' },
        loadComponent: () =>
          import('./features/users-basic/operational-users-page.component').then(
            (m) => m.OperationalUsersPageComponent
          )
      },
      {
        path: 'operations/basic-configuration',
        title: 'Configuracion basica',
        canActivate: [authorizationGuard],
        data: { resource: 'configuration:basic', action: 'read' },
        loadComponent: () =>
          import('./features/users-basic/basic-configuration-page.component').then(
            (m) => m.BasicConfigurationPageComponent
          )
      },
      {
        path: 'sports',
        title: 'Sports',
        canActivate: [authorizationGuard],
        data: { resource: 'sports', action: 'read' },
        loadComponent: () =>
          import('./features/sports/sports-page.component').then((m) => m.SportsPageComponent)
      },
      {
        path: 'teams',
        title: 'Teams',
        canActivate: [authorizationGuard],
        data: { resource: 'teams', action: 'read' },
        loadComponent: () =>
          import('./features/teams/team-list-page.component').then((m) => m.TeamListPageComponent)
      },
      {
        path: 'teams/new',
        title: 'Create Team',
        canActivate: [authorizationGuard],
        data: { resource: 'teams', action: 'manage' },
        loadComponent: () =>
          import('./features/teams/team-form-page.component').then((m) => m.TeamFormPageComponent)
      },
      {
        path: 'teams/:id/edit',
        title: 'Edit Team',
        canActivate: [authorizationGuard],
        data: { resource: 'teams', action: 'manage' },
        loadComponent: () =>
          import('./features/teams/team-form-page.component').then((m) => m.TeamFormPageComponent)
      },
      {
        path: 'players',
        title: 'Players',
        canActivate: [authorizationGuard],
        data: { resource: 'players', action: 'read' },
        loadComponent: () =>
          import('./features/players/player-list-page.component').then((m) => m.PlayerListPageComponent)
      },
      {
        path: 'players/new',
        title: 'Create Player',
        canActivate: [authorizationGuard],
        data: { resource: 'players', action: 'manage' },
        loadComponent: () =>
          import('./features/players/player-form-page.component').then((m) => m.PlayerFormPageComponent)
      },
      {
        path: 'players/:id/edit',
        title: 'Edit Player',
        canActivate: [authorizationGuard],
        data: { resource: 'players', action: 'manage' },
        loadComponent: () =>
          import('./features/players/player-form-page.component').then((m) => m.PlayerFormPageComponent)
      },
      {
        path: 'tournaments',
        title: 'Tournaments',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read' },
        loadComponent: () =>
          import('./features/tournaments/tournament-list-page.component').then(
            (m) => m.TournamentListPageComponent
          )
      },
      {
        path: 'tournaments/new',
        title: 'Create Tournament',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'manage' },
        loadComponent: () =>
          import('./features/tournaments/tournament-form-page.component').then(
            (m) => m.TournamentFormPageComponent
          )
      },
      {
        path: 'tournaments/:id/edit',
        title: 'Edit Tournament',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'manage' },
        loadComponent: () =>
          import('./features/tournaments/tournament-form-page.component').then(
            (m) => m.TournamentFormPageComponent
          )
      },
      {
        path: 'tournaments/:id',
        title: 'Tournament Detail',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read' },
        loadComponent: () =>
          import('./features/tournaments/tournament-detail-page.component').then(
            (m) => m.TournamentDetailPageComponent
          )
      },
      {
        path: 'tournaments/:id/competition-advanced',
        title: 'Competition Advanced',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read' },
        loadComponent: () =>
          import('./features/competition-advanced/competition-advanced-page.component').then(
            (m) => m.CompetitionAdvancedPageComponent
          )
      },
      {
        path: 'tournaments/:id/statistics/basic',
        title: 'Basic Statistics',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read' },
        loadComponent: () =>
          import('./features/statistics-basic/statistics-basic-page.component').then(
            (m) => m.StatisticsBasicPageComponent
          )
      },
      {
        path: 'tournaments/:id/discipline',
        title: 'Discipline Sanctions',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read' },
        loadComponent: () =>
          import('./features/discipline/discipline-tournament-page.component').then(
            (m) => m.DisciplineTournamentPageComponent
          )
      },
      {
        path: 'tournaments/:id/finances/basic',
        title: 'Finanzas basicas',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read' },
        loadComponent: () =>
          import('./features/finances-basic/finances-basic-page.component').then(
            (m) => m.FinancesBasicPageComponent
          )
      },
      {
        path: 'competition-advanced',
        title: 'Competencia avanzada',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read', module: 'competitionAdvanced' },
        loadComponent: () =>
          import('./features/tournament-modules/tournament-module-hub.component').then(
            (m) => m.TournamentModuleHubComponent
          )
      },
      {
        path: 'statistics-basic',
        title: 'Estadisticas basicas',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read', module: 'statisticsBasic' },
        loadComponent: () =>
          import('./features/tournament-modules/tournament-module-hub.component').then(
            (m) => m.TournamentModuleHubComponent
          )
      },
      {
        path: 'discipline',
        title: 'Disciplina',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read', module: 'discipline' },
        loadComponent: () =>
          import('./features/tournament-modules/tournament-module-hub.component').then(
            (m) => m.TournamentModuleHubComponent
          )
      },
      {
        path: 'finances-basic',
        title: 'Finanzas basicas',
        canActivate: [authorizationGuard],
        data: { resource: 'tournaments', action: 'read', module: 'financesBasic' },
        loadComponent: () =>
          import('./features/tournament-modules/tournament-module-hub.component').then(
            (m) => m.TournamentModuleHubComponent
          )
      },
      {
        path: 'tournament-teams',
        title: 'Tournament Teams',
        canActivate: [authorizationGuard],
        data: { resource: 'tournamentTeams', action: 'read' },
        loadComponent: () =>
          import('./features/tournament-teams/tournament-team-list-page.component').then(
            (m) => m.TournamentTeamListPageComponent
          )
      },
      {
        path: 'tournament-teams/new',
        title: 'Create Tournament Team',
        canActivate: [authorizationGuard],
        data: { resource: 'tournamentTeams', action: 'manage' },
        loadComponent: () =>
          import('./features/tournament-teams/tournament-team-form-page.component').then(
            (m) => m.TournamentTeamFormPageComponent
          )
      },
      {
        path: 'tournament-teams/:id/edit',
        title: 'Edit Tournament Team',
        canActivate: [authorizationGuard],
        data: { resource: 'tournamentTeams', action: 'manage' },
        loadComponent: () =>
          import('./features/tournament-teams/tournament-team-form-page.component').then(
            (m) => m.TournamentTeamFormPageComponent
          )
      },
      {
        path: 'rosters',
        title: 'Planteles',
        canActivate: [authorizationGuard],
        data: { resource: 'rosters', action: 'read' },
        loadComponent: () =>
          import('./features/rosters/roster-list-page.component').then(
            (m) => m.RosterListPageComponent
          )
      },
      {
        path: 'rosters/new',
        title: 'Create Roster Entry',
        canActivate: [authorizationGuard],
        data: { resource: 'rosters', action: 'manage' },
        loadComponent: () =>
          import('./features/rosters/roster-form-page.component').then(
            (m) => m.RosterFormPageComponent
          )
      },
      {
        path: 'rosters/:id/edit',
        title: 'Edit Roster Entry',
        canActivate: [authorizationGuard],
        data: { resource: 'rosters', action: 'manage' },
        loadComponent: () =>
          import('./features/rosters/roster-form-page.component').then(
            (m) => m.RosterFormPageComponent
          )
      },
      {
        path: 'tournament-stages',
        title: 'Tournament Stages',
        canActivate: [authorizationGuard],
        data: { resource: 'tournamentStages', action: 'read' },
        loadComponent: () =>
          import('./features/tournament-stages/tournament-stage-list-page.component').then(
            (m) => m.TournamentStageListPageComponent
          )
      },
      {
        path: 'tournament-stages/new',
        title: 'Create Tournament Stage',
        canActivate: [authorizationGuard],
        data: { resource: 'tournamentStages', action: 'manage' },
        loadComponent: () =>
          import('./features/tournament-stages/tournament-stage-form-page.component').then(
            (m) => m.TournamentStageFormPageComponent
          )
      },
      {
        path: 'tournament-stages/:id/edit',
        title: 'Edit Tournament Stage',
        canActivate: [authorizationGuard],
        data: { resource: 'tournamentStages', action: 'manage' },
        loadComponent: () =>
          import('./features/tournament-stages/tournament-stage-form-page.component').then(
            (m) => m.TournamentStageFormPageComponent
          )
      },
      {
        path: 'stage-groups',
        title: 'Stage Groups',
        canActivate: [authorizationGuard],
        data: { resource: 'stageGroups', action: 'read' },
        loadComponent: () =>
          import('./features/stage-groups/stage-group-list-page.component').then(
            (m) => m.StageGroupListPageComponent
          )
      },
      {
        path: 'stage-groups/new',
        title: 'Create Stage Group',
        canActivate: [authorizationGuard],
        data: { resource: 'stageGroups', action: 'manage' },
        loadComponent: () =>
          import('./features/stage-groups/stage-group-form-page.component').then(
            (m) => m.StageGroupFormPageComponent
          )
      },
      {
        path: 'stage-groups/:id/edit',
        title: 'Edit Stage Group',
        canActivate: [authorizationGuard],
        data: { resource: 'stageGroups', action: 'manage' },
        loadComponent: () =>
          import('./features/stage-groups/stage-group-form-page.component').then(
            (m) => m.StageGroupFormPageComponent
          )
      },
      {
        path: 'matches',
        title: 'Matches',
        canActivate: [authorizationGuard],
        data: { resource: 'matches', action: 'read' },
        loadComponent: () =>
          import('./features/matches/match-list-page.component').then((m) => m.MatchListPageComponent)
      },
      {
        path: 'matches/new',
        title: 'Create Match',
        canActivate: [authorizationGuard],
        data: { resource: 'matches', action: 'manage' },
        loadComponent: () =>
          import('./features/matches/match-form-page.component').then((m) => m.MatchFormPageComponent)
      },
      {
        path: 'matches/:id/edit',
        title: 'Edit Match',
        canActivate: [authorizationGuard],
        data: { resource: 'matches', action: 'manage' },
        loadComponent: () =>
          import('./features/matches/match-form-page.component').then((m) => m.MatchFormPageComponent)
      },
      {
        path: 'matches/:id/discipline',
        title: 'Match Discipline',
        canActivate: [authorizationGuard],
        data: { resource: 'matches', action: 'read' },
        loadComponent: () =>
          import('./features/discipline/discipline-match-page.component').then(
            (m) => m.DisciplineMatchPageComponent
          )
      },
      {
        path: 'standings',
        title: 'Tabla de posiciones',
        canActivate: [authorizationGuard],
        data: { resource: 'standings', action: 'read' },
        loadComponent: () =>
          import('./features/standings/standings-page.component').then((m) => m.StandingsPageComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
