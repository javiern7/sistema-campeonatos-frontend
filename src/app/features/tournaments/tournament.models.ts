import { PageResponse } from '../../core/api/api.models';

export type TournamentFormat = 'LEAGUE' | 'GROUPS_THEN_KNOCKOUT' | 'KNOCKOUT';
export type TournamentStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
export type TournamentOperationalCategory = 'PRODUCTION' | 'QA' | 'DEMO' | 'SANDBOX' | 'ARCHIVED';

export type TournamentIntegrityAlertCode =
  | 'APPROVED_TEAMS_MISSING_ACTIVE_ROSTER_SUPPORT'
  | 'CLOSED_MATCHES_WITHOUT_FULL_ACTIVE_ROSTER_SUPPORT'
  | 'CLOSED_MATCHES_WITHOUT_STANDINGS'
  | 'STANDINGS_WITHOUT_CLOSED_MATCHES'
  | 'CLOSED_MATCHES_WITHOUT_APPROVED_TEAMS';

export interface Tournament {
  id: number;
  sportId: number;
  name: string;
  slug: string;
  seasonName: string;
  format: TournamentFormat;
  status: TournamentStatus;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  maxTeams: number | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  operationalCategory: TournamentOperationalCategory;
  executiveReportingEligible: boolean;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentFilters {
  name?: string;
  sportId?: number | '';
  status?: TournamentStatus | '';
  page?: number;
  size?: number;
}

export interface TournamentFormValue {
  sportId: number;
  name: string;
  seasonName: string;
  format: TournamentFormat;
  status: TournamentStatus;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  maxTeams: number | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
}

export interface TournamentStatusTransitionPayload {
  targetStatus: TournamentStatus;
}

export interface TournamentOperationalSummary {
  tournamentId: number;
  tournamentName: string;
  tournamentStatus: TournamentStatus;
  operationalCategory: TournamentOperationalCategory;
  executiveReportingEligible: boolean;
  integrityHealthy: boolean;
  approvedTeams: number;
  approvedTeamsWithActiveRosterSupport: number;
  approvedTeamsMissingActiveRosterSupport: number;
  closedMatches: number;
  generatedStandings: number;
  integrityAlerts: TournamentIntegrityAlertCode[];
}

export interface TournamentOperationalSummaryFilters {
  name?: string;
  sportId?: number | '';
  status?: TournamentStatus | '';
  operationalCategory?: TournamentOperationalCategory | '';
  executiveOnly?: boolean;
  page?: number;
  size?: number;
}

export type TournamentPage = PageResponse<Tournament>;
export type TournamentOperationalSummaryPage = PageResponse<TournamentOperationalSummary>;
