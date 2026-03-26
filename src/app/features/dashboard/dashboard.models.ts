import { TournamentStatus } from '../tournaments/tournament.models';

export type DashboardHealth = 'healthy' | 'warning' | 'attention';

export interface DashboardAlert {
  title: string;
  detail: string;
  health: DashboardHealth;
  tournamentId: number;
  tournamentName: string;
  sportName: string;
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
  stageCount: number;
  groupCount: number;
  registrationCount: number;
  approvedRegistrationCount: number;
  activeRosterCount: number;
  matchCount: number;
  playedMatchCount: number;
  scheduledMatchCount: number;
  incidentMatchCount: number;
  standingsCount: number;
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
  registrationCount: number;
  approvedRegistrationCount: number;
  matchCount: number;
  playedMatchCount: number;
  scheduledMatchCount: number;
  activeRosterCount: number;
  standingsCount: number;
  attentionTournamentCount: number;
  sportSummaries: DashboardSportSummary[];
  tournamentSummaries: DashboardTournamentSummary[];
  alerts: DashboardAlert[];
}
