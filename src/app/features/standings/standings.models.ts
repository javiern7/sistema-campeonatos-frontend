import { PageResponse } from '../../core/api/api.models';

export interface Standing {
  id: number;
  tournamentId: number;
  stageId: number | null;
  groupId: number | null;
  tournamentTeamId: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  scoreDiff: number;
  points: number;
  rankPosition: number | null;
  updatedAt: string;
}

export interface StandingFilters {
  tournamentId?: number | '';
  stageId?: number | '';
  groupId?: number | '';
  tournamentTeamId?: number | '';
  page?: number;
  size?: number;
}

export interface StandingFormValue {
  tournamentId: number;
  stageId: number | null;
  groupId: number | null;
  tournamentTeamId: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  scoreDiff: number;
  points: number;
  rankPosition: number | null;
}

export type StandingUpdateValue = Omit<StandingFormValue, 'tournamentId'>;

export interface StandingRecalculationRequest {
  tournamentId: number;
  stageId: number | null;
  groupId: number | null;
}

export interface StandingRecalculationResponse {
  tournamentId: number;
  stageId: number | null;
  groupId: number | null;
  matchesProcessed: number;
  standingsGenerated: number;
}

export type StandingPage = PageResponse<Standing>;
