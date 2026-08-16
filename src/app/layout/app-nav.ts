import type { AuthorizationAction, AuthorizationResource } from '../core/auth/authorization.service';

export interface AppNavItem {
  label: string;
  path: string;
  resource?: AuthorizationResource;
  action?: AuthorizationAction;
}

export interface AppNavGroup {
  label: string;
  items: AppNavItem[];
}

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    label: 'Inicio',
    items: [{ label: 'Panel principal', path: '/dashboard', resource: 'dashboard' }]
  },
  {
    label: 'Campeonatos',
    items: [
      { label: 'Campeonatos', path: '/tournaments', resource: 'tournaments' },
      { label: 'Nuevo campeonato', path: '/tournaments/new', resource: 'tournaments', action: 'manage' }
    ]
  },
  {
    label: 'Participantes',
    items: [
      { label: 'Equipos', path: '/teams', resource: 'teams' },
      { label: 'Jugadores', path: '/players', resource: 'players' },
      { label: 'Inscripciones', path: '/tournament-teams', resource: 'tournamentTeams' },
      { label: 'Planteles', path: '/rosters', resource: 'rosters' }
    ]
  },
  {
    label: 'Competencia',
    items: [
      { label: 'Partidos', path: '/matches', resource: 'matches' },
      { label: 'Etapas', path: '/tournament-stages', resource: 'tournamentStages' },
      { label: 'Grupos', path: '/stage-groups', resource: 'stageGroups' },
      { label: 'Competencia avanzada', path: '/competition-advanced', resource: 'tournaments' },
      { label: 'Disciplina', path: '/discipline', resource: 'tournaments' }
    ]
  },
  {
    label: 'Tabla y estadisticas',
    items: [
      { label: 'Tabla de posiciones', path: '/standings', resource: 'standings' },
      { label: 'Estadisticas basicas', path: '/statistics-basic', resource: 'tournaments' },
      { label: 'Estadisticas por eventos', path: '/statistics-events', resource: 'matches' }
    ]
  },
  {
    label: 'Reportes',
    items: [
      { label: 'Reportes y exportaciones', path: '/reporting', resource: 'tournaments' },
      { label: 'Finanzas basicas', path: '/finances-basic', resource: 'tournaments' }
    ]
  },
  {
    label: 'Portal publico',
    items: [{ label: 'Ver portal publico', path: '/portal' }]
  },
  {
    label: 'Administracion',
    items: [
      { label: 'Usuarios', path: '/operations/users', resource: 'users' },
      { label: 'Configuracion basica', path: '/operations/basic-configuration', resource: 'configuration:basic' },
      { label: 'Configuracion multideporte', path: '/operations/master-configuration', resource: 'sports' }
    ]
  }
];

export const APP_NAV_ITEMS: AppNavItem[] = APP_NAV_GROUPS.flatMap((group) => group.items);
