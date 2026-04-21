import { PageResponse } from '../../core/api/api.models';

export type PublicTournamentFormat = 'LEAGUE' | 'GROUPS_THEN_KNOCKOUT' | 'KNOCKOUT';
export type PublicTournamentStatus = 'OPEN' | 'IN_PROGRESS' | 'FINISHED';

export interface PublicPortalModules {
  tournamentsEnabled: boolean;
  standingsEnabled: boolean;
  resultsEnabled: boolean;
  approvedPiecesEnabled: boolean;
}

export interface PublicTournamentSummary {
  id: number;
  sportId: number;
  sportName: string;
  name: string;
  slug: string;
  seasonName: string;
  format: PublicTournamentFormat;
  status: PublicTournamentStatus;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface PublicHome {
  portalName: string;
  generatedAt: string;
  visibleTournamentCount: number;
  liveTournamentCount: number;
  upcomingTournamentCount: number;
  completedTournamentCount: number;
  featuredTournaments: PublicTournamentSummary[];
  modules: PublicPortalModules;
}

export interface PublicTournamentListFilters {
  name?: string;
  sportId?: number | '';
  status?: PublicTournamentStatus | '';
  page?: number;
  size?: number;
  sort?: string;
}

export interface PublicTournamentDetail extends PublicTournamentSummary {
  updatedAt: string;
  modules: PublicPortalModules;
}

export interface PublicStandingEntry {
  position: number;
  teamName: string;
  teamShortName: string | null;
  teamCode: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  scoreDiff: number;
  points: number;
}

export interface PublicTournamentStandings {
  tournamentId: number;
  tournamentSlug: string;
  stageId: number | null;
  stageName: string | null;
  stageType: string | null;
  groupId: number | null;
  groupCode: string | null;
  groupName: string | null;
  totalEntries: number;
  standings: PublicStandingEntry[];
}

export interface PublicTournamentContextFilters {
  stageId?: number | '';
  groupId?: number | '';
}

export type PublicMatchStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'PLAYED'
  | 'FORFEIT'
  | 'CANCELLED'
  | 'POSTPONED'
  | string;

export interface PublicTournamentCalendarFilters extends PublicTournamentContextFilters {
  status?: PublicMatchStatus | '';
  from?: string;
  to?: string;
}

export interface PublicResultTeam {
  tournamentTeamId: number;
  teamId: number;
  teamName: string;
  shortName: string | null;
  code: string | null;
  seedNumber: number | null;
}

export interface PublicMatchSummary {
  matchId: number;
  stageId: number | null;
  stageName: string | null;
  stageType: string | null;
  groupId: number | null;
  groupCode: string | null;
  groupName: string | null;
  roundNumber: number | null;
  matchdayNumber: number | null;
  scheduledAt: string | null;
  venueName: string | null;
  status: PublicMatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: PublicResultTeam;
  awayTeam: PublicResultTeam;
  winnerTeam: PublicResultTeam | null;
}

export interface PublicTournamentResultEntry {
  match: PublicMatchSummary;
  affectsStandings: boolean;
  standingScope: string | null;
  standingStatus: string | null;
}

export interface PublicTournamentResults {
  tournamentId: number;
  tournamentSlug: string;
  stageId: number | null;
  groupId: number | null;
  totalClosedMatches: number;
  results: PublicTournamentResultEntry[];
}

export interface PublicTournamentCalendar {
  tournamentId: number;
  tournamentSlug: string;
  stageId: number | null;
  groupId: number | null;
  status: PublicMatchStatus | null;
  from: string | null;
  to: string | null;
  totalMatches: number;
  scheduledMatches: number;
  closedMatches: number;
  matches: PublicMatchSummary[];
}

export type PublicTournamentPage = PageResponse<PublicTournamentSummary>;
