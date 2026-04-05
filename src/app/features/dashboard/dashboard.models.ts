import {
  TournamentIntegrityAlertCode,
  TournamentOperationalCategory,
  TournamentStatus
} from '../tournaments/tournament.models';

export type DashboardHealth = 'healthy' | 'warning' | 'attention';
export type DashboardReportingSegment = 'operational' | 'setup' | 'sandbox';
export type DashboardAuditStatus = 'blocked' | 'partial' | 'ready';
export type DashboardAlertType =
  | 'registrations'
  | 'rosters'
  | 'matches'
  | 'standings'
  | 'state'
  | 'sandbox';

export interface DashboardAlert {
  title: string;
  detail: string;
  health: DashboardHealth;
  type: DashboardAlertType;
  tournamentId: number;
  tournamentName: string;
  sportName: string;
  actionLabel: string;
  actionPath: string;
  actionQueryParams: Record<string, string | number>;
}

export interface DashboardSportSummary {
  sportId: number;
  sportName: string;
  tournamentCount: number;
  liveTournamentCount: number;
  registrationCount: number;
  approvedRegistrationCount: number;
  activeRosterCount: number;
  matchCount: number;
  playedMatchCount: number;
  standingsCount: number;
  alertCount: number;
  health: DashboardHealth;
  healthMessage: string;
}

export interface DashboardTournamentSummary {
  tournamentId: number;
  tournamentName: string;
  sportName: string;
  status: TournamentStatus;
  operationalCategory: TournamentOperationalCategory;
  executiveReportingEligible: boolean;
  integrityHealthy: boolean;
  integrityAlertCodes: TournamentIntegrityAlertCode[];
  reportingSegment: DashboardReportingSegment;
  qaSignal: boolean;
  stageCount: number;
  groupCount: number;
  registrationCount: number;
  approvedRegistrationCount: number;
  registrationsWithActiveRosterCount: number;
  rosterGapCount: number;
  activeRosterCount: number;
  matchCount: number;
  playedMatchCount: number;
  scheduledMatchCount: number;
  incidentMatchCount: number;
  standingsCount: number;
  standingsCoverageCount: number;
  readinessScore: number;
  auditStatus: DashboardAuditStatus;
  auditMessage: string;
  blockers: string[];
  leaderName: string | null;
  leaderPoints: number | null;
  health: DashboardHealth;
  nextAction: string;
}

export interface DashboardSummary {
  sportCount: number;
  teamCount: number;
  playerCount: number;
  tournamentCount: number;
  activeTournamentCount: number;
  liveTournamentCount: number;
  operationalTournamentCount: number;
  setupTournamentCount: number;
  sandboxTournamentCount: number;
  registrationCount: number;
  approvedRegistrationCount: number;
  matchCount: number;
  playedMatchCount: number;
  scheduledMatchCount: number;
  activeRosterCount: number;
  standingsCount: number;
  attentionTournamentCount: number;
  rosterGapTournamentCount: number;
  standingsGapTournamentCount: number;
  readyTournamentCount: number;
  sportSummaries: DashboardSportSummary[];
  tournamentSummaries: DashboardTournamentSummary[];
  alerts: DashboardAlert[];
}
