import type { AuthorizationResource } from '../core/auth/authorization.service';

export interface AppNavItem {
  label: string;
  path: string;
  resource?: AuthorizationResource;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Sports', path: '/sports' },
  { label: 'Tournaments', path: '/tournaments', resource: 'tournaments' },
  { label: 'Tournament Teams', path: '/tournament-teams', resource: 'tournamentTeams' },
  { label: 'Tournament Stages', path: '/tournament-stages', resource: 'tournamentStages' },
  { label: 'Stage Groups', path: '/stage-groups', resource: 'stageGroups' },
  { label: 'Teams', path: '/teams', resource: 'teams' },
  { label: 'Players', path: '/players', resource: 'players' },
  { label: 'Rosters', path: '/rosters', resource: 'rosters' },
  { label: 'Matches', path: '/matches', resource: 'matches' },
  { label: 'Standings', path: '/standings', resource: 'standings' }
];
