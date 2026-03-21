import { PageResponse } from '../../core/api/api.models';

export type TournamentTeamRegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface TournamentTeam {
  id: number;
  tournamentId: number;
  teamId: number;
  registrationStatus: TournamentTeamRegistrationStatus;
  seedNumber: number | null;
  groupDrawPosition: number | null;
  joinedAt: string;
}

export interface TournamentTeamFilters {
  tournamentId?: number | '';
  teamId?: number | '';
  registrationStatus?: TournamentTeamRegistrationStatus | '';
  page?: number;
  size?: number;
}

export interface TournamentTeamFormValue {
  tournamentId: number;
  teamId: number;
  registrationStatus: TournamentTeamRegistrationStatus;
  seedNumber: number | null;
  groupDrawPosition: number | null;
}

export type TournamentTeamPage = PageResponse<TournamentTeam>;
