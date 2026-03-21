import { PageResponse } from '../../core/api/api.models';

export type TournamentStageType = 'LEAGUE' | 'GROUP_STAGE' | 'KNOCKOUT';

export interface TournamentStage {
  id: number;
  tournamentId: number;
  name: string;
  stageType: TournamentStageType;
  sequenceOrder: number;
  legs: number;
  roundTrip: boolean;
  active: boolean;
  createdAt: string;
}

export interface TournamentStageFilters {
  tournamentId?: number | '';
  stageType?: TournamentStageType | '';
  active?: boolean | '';
  page?: number;
  size?: number;
}

export interface TournamentStageFormValue {
  tournamentId: number;
  name: string;
  stageType: TournamentStageType;
  sequenceOrder: number;
  legs: number;
  roundTrip: boolean;
  active: boolean;
}

export type TournamentStagePage = PageResponse<TournamentStage>;
