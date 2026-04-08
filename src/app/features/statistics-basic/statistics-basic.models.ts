import { TournamentStageType } from '../tournament-stages/tournament-stage.models';

export type StatisticsBasicLeaderStatus = 'AVAILABLE' | 'PENDING_RECALCULATION' | 'NOT_APPLICABLE' | string;

export interface StatisticsBasicLeaderTeam {
  tournamentTeamId?: number | null;
  teamId?: number | null;
  label?: string | null;
  teamName?: string | null;
  name?: string | null;
  shortName?: string | null;
}

export interface StatisticsBasicSummary {
  registeredTeams: number;
  totalMatches: number;
  playedMatches: number;
  scheduledMatches: number;
  forfeitMatches: number;
  cancelledMatches: number;
  scoredPointsFor: number;
  scoredPointsAgainst: number;
  averagePointsPerPlayedMatch: number;
  lastPlayedAt: string | null;
}

export interface StatisticsBasicLeader {
  metric: string;
  status: StatisticsBasicLeaderStatus;
  scope: string | null;
  value: number | null;
  team: StatisticsBasicLeaderTeam | null;
  tieCount: number;
}

export interface StatisticsBasicLeaders {
  pointsLeader: StatisticsBasicLeader | null;
  winsLeader: StatisticsBasicLeader | null;
  scoreDiffLeader: StatisticsBasicLeader | null;
  scoringLeader: StatisticsBasicLeader | null;
}

export interface StatisticsBasicTraceability {
  derivedFromMatches: boolean;
  derivedFromStandings: boolean;
  classificationSource: TournamentStageType | 'TOURNAMENT' | 'STAGE' | 'GROUP' | string | null;
  notes: string[];
}

export interface StatisticsBasicFilters {
  stageId?: number | '';
  groupId?: number | '';
}

export interface StatisticsBasicResponse {
  tournamentId: number;
  stageId: number | null;
  groupId: number | null;
  summary: StatisticsBasicSummary;
  leaders: StatisticsBasicLeaders;
  traceability: StatisticsBasicTraceability;
}
