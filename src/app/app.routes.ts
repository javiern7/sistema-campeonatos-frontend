import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Routes = [
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
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent)
      },
      {
        path: 'sports',
        title: 'Sports',
        loadComponent: () =>
          import('./features/sports/sports-page.component').then((m) => m.SportsPageComponent)
      },
      {
        path: 'teams',
        title: 'Teams',
        loadComponent: () =>
          import('./features/teams/team-list-page.component').then((m) => m.TeamListPageComponent)
      },
      {
        path: 'teams/new',
        title: 'Create Team',
        loadComponent: () =>
          import('./features/teams/team-form-page.component').then((m) => m.TeamFormPageComponent)
      },
      {
        path: 'teams/:id/edit',
        title: 'Edit Team',
        loadComponent: () =>
          import('./features/teams/team-form-page.component').then((m) => m.TeamFormPageComponent)
      },
      {
        path: 'players',
        title: 'Players',
        loadComponent: () =>
          import('./features/players/player-list-page.component').then((m) => m.PlayerListPageComponent)
      },
      {
        path: 'players/new',
        title: 'Create Player',
        loadComponent: () =>
          import('./features/players/player-form-page.component').then((m) => m.PlayerFormPageComponent)
      },
      {
        path: 'players/:id/edit',
        title: 'Edit Player',
        loadComponent: () =>
          import('./features/players/player-form-page.component').then((m) => m.PlayerFormPageComponent)
      },
      {
        path: 'tournaments',
        title: 'Tournaments',
        loadComponent: () =>
          import('./features/tournaments/tournament-list-page.component').then(
            (m) => m.TournamentListPageComponent
          )
      },
      {
        path: 'tournaments/new',
        title: 'Create Tournament',
        loadComponent: () =>
          import('./features/tournaments/tournament-form-page.component').then(
            (m) => m.TournamentFormPageComponent
          )
      },
      {
        path: 'tournaments/:id/edit',
        title: 'Edit Tournament',
        loadComponent: () =>
          import('./features/tournaments/tournament-form-page.component').then(
            (m) => m.TournamentFormPageComponent
          )
      },
      {
        path: 'tournament-teams',
        title: 'Tournament Teams',
        loadComponent: () =>
          import('./features/tournament-teams/tournament-team-list-page.component').then(
            (m) => m.TournamentTeamListPageComponent
          )
      },
      {
        path: 'tournament-teams/new',
        title: 'Create Tournament Team',
        loadComponent: () =>
          import('./features/tournament-teams/tournament-team-form-page.component').then(
            (m) => m.TournamentTeamFormPageComponent
          )
      },
      {
        path: 'tournament-teams/:id/edit',
        title: 'Edit Tournament Team',
        loadComponent: () =>
          import('./features/tournament-teams/tournament-team-form-page.component').then(
            (m) => m.TournamentTeamFormPageComponent
          )
      },
      {
        path: 'rosters',
        title: 'Rosters',
        loadComponent: () =>
          import('./features/rosters/roster-list-page.component').then(
            (m) => m.RosterListPageComponent
          )
      },
      {
        path: 'rosters/new',
        title: 'Create Roster Entry',
        loadComponent: () =>
          import('./features/rosters/roster-form-page.component').then(
            (m) => m.RosterFormPageComponent
          )
      },
      {
        path: 'rosters/:id/edit',
        title: 'Edit Roster Entry',
        loadComponent: () =>
          import('./features/rosters/roster-form-page.component').then(
            (m) => m.RosterFormPageComponent
          )
      },
      {
        path: 'tournament-stages',
        title: 'Tournament Stages',
        loadComponent: () =>
          import('./features/tournament-stages/tournament-stage-list-page.component').then(
            (m) => m.TournamentStageListPageComponent
          )
      },
      {
        path: 'tournament-stages/new',
        title: 'Create Tournament Stage',
        loadComponent: () =>
          import('./features/tournament-stages/tournament-stage-form-page.component').then(
            (m) => m.TournamentStageFormPageComponent
          )
      },
      {
        path: 'tournament-stages/:id/edit',
        title: 'Edit Tournament Stage',
        loadComponent: () =>
          import('./features/tournament-stages/tournament-stage-form-page.component').then(
            (m) => m.TournamentStageFormPageComponent
          )
      },
      {
        path: 'stage-groups',
        title: 'Stage Groups',
        loadComponent: () =>
          import('./features/stage-groups/stage-group-list-page.component').then(
            (m) => m.StageGroupListPageComponent
          )
      },
      {
        path: 'stage-groups/new',
        title: 'Create Stage Group',
        loadComponent: () =>
          import('./features/stage-groups/stage-group-form-page.component').then(
            (m) => m.StageGroupFormPageComponent
          )
      },
      {
        path: 'stage-groups/:id/edit',
        title: 'Edit Stage Group',
        loadComponent: () =>
          import('./features/stage-groups/stage-group-form-page.component').then(
            (m) => m.StageGroupFormPageComponent
          )
      },
      {
        path: 'matches',
        title: 'Matches',
        loadComponent: () =>
          import('./features/matches/match-list-page.component').then((m) => m.MatchListPageComponent)
      },
      {
        path: 'matches/new',
        title: 'Create Match',
        loadComponent: () =>
          import('./features/matches/match-form-page.component').then((m) => m.MatchFormPageComponent)
      },
      {
        path: 'matches/:id/edit',
        title: 'Edit Match',
        loadComponent: () =>
          import('./features/matches/match-form-page.component').then((m) => m.MatchFormPageComponent)
      },
      {
        path: 'standings',
        title: 'Standings',
        loadComponent: () =>
          import('./features/standings/standings-page.component').then((m) => m.StandingsPageComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
