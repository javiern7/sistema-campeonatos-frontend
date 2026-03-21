import { PageResponse } from '../../core/api/api.models';

export type RosterStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface RosterEntry {
  id: number;
  tournamentTeamId: number;
  playerId: number;
  jerseyNumber: number | null;
  captain: boolean;
  positionName: string | null;
  rosterStatus: RosterStatus;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

export interface RosterFilters {
  tournamentTeamId?: number | '';
  playerId?: number | '';
  rosterStatus?: RosterStatus | '';
  page?: number;
  size?: number;
}

export interface RosterFormValue {
  tournamentTeamId: number;
  playerId: number;
  jerseyNumber: number | null;
  captain: boolean;
  positionName: string | null;
  rosterStatus: RosterStatus;
  startDate: string;
  endDate: string | null;
}

export type RosterPage = PageResponse<RosterEntry>;
