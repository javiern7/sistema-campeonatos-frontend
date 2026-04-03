import { PageResponse } from '../../core/api/api.models';

export type TournamentFormat = 'LEAGUE' | 'GROUPS_THEN_KNOCKOUT' | 'KNOCKOUT';
export type TournamentStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

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

export type TournamentPage = PageResponse<Tournament>;
