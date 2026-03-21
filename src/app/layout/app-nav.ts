export interface AppNavItem {
  label: string;
  path: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Sports', path: '/sports' },
  { label: 'Tournaments', path: '/tournaments' },
  { label: 'Tournament Teams', path: '/tournament-teams' },
  { label: 'Tournament Stages', path: '/tournament-stages' },
  { label: 'Stage Groups', path: '/stage-groups' },
  { label: 'Teams', path: '/teams' },
  { label: 'Players', path: '/players' },
  { label: 'Rosters', path: '/rosters' },
  { label: 'Matches', path: '/matches' },
  { label: 'Standings', path: '/standings' }
];
