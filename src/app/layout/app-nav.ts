import type { AuthorizationResource } from '../core/auth/authorization.service';

export interface AppNavItem {
  label: string;
  path: string;
  resource?: AuthorizationResource;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: 'Inicio', path: '/dashboard', resource: 'dashboard' },
  { label: 'Usuarios', path: '/operations/users', resource: 'users' },
  { label: 'Configuracion basica', path: '/operations/basic-configuration', resource: 'configuration:basic' },
  { label: 'Configuracion multideporte', path: '/operations/master-configuration', resource: 'sports' },
  { label: 'Torneos', path: '/tournaments', resource: 'tournaments' },
  { label: 'Competencia avanzada', path: '/competition-advanced', resource: 'tournaments' },
  { label: 'Estadisticas basicas', path: '/statistics-basic', resource: 'tournaments' },
  { label: 'Estadisticas eventos', path: '/statistics-events', resource: 'matches' },
  { label: 'Disciplina', path: '/discipline', resource: 'tournaments' },
  { label: 'Finanzas basicas', path: '/finances-basic', resource: 'tournaments' },
  { label: 'Inscripciones', path: '/tournament-teams', resource: 'tournamentTeams' },
  { label: 'Etapas', path: '/tournament-stages', resource: 'tournamentStages' },
  { label: 'Grupos', path: '/stage-groups', resource: 'stageGroups' },
  { label: 'Equipos', path: '/teams', resource: 'teams' },
  { label: 'Jugadores', path: '/players', resource: 'players' },
  { label: 'Planteles', path: '/rosters', resource: 'rosters' },
  { label: 'Partidos', path: '/matches', resource: 'matches' },
  { label: 'Tabla de posiciones', path: '/standings', resource: 'standings' }
];
