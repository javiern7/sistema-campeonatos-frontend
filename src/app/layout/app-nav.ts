import type { AuthorizationResource } from '../core/auth/authorization.service';

export interface AppNavItem {
  label: string;
  path: string;
  resource?: AuthorizationResource;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: 'Dashboard', path: '/dashboard', resource: 'dashboard' },
  { label: 'Deportes', path: '/sports', resource: 'sports' },
  { label: 'Torneos', path: '/tournaments', resource: 'tournaments' },
  { label: 'Inscripciones', path: '/tournament-teams', resource: 'tournamentTeams' },
  { label: 'Etapas', path: '/tournament-stages', resource: 'tournamentStages' },
  { label: 'Grupos', path: '/stage-groups', resource: 'stageGroups' },
  { label: 'Equipos', path: '/teams', resource: 'teams' },
  { label: 'Jugadores', path: '/players', resource: 'players' },
  { label: 'Rosters', path: '/rosters', resource: 'rosters' },
  { label: 'Partidos', path: '/matches', resource: 'matches' },
  { label: 'Standings', path: '/standings', resource: 'standings' }
];
