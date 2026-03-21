import { PageResponse } from '../../core/api/api.models';

export type MatchStatus = 'SCHEDULED' | 'PLAYED' | 'FORFEIT' | 'CANCELLED';

export interface MatchGame {
  id: number;
  tournamentId: number;
  stageId: number | null;
  groupId: number | null;
  roundNumber: number | null;
  matchdayNumber: number | null;
  homeTournamentTeamId: number;
  awayTournamentTeamId: number;
  scheduledAt: string | null;
  venueName: string | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  winnerTournamentTeamId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchFilters {
  tournamentId?: number | '';
  stageId?: number | '';
  groupId?: number | '';
  status?: MatchStatus | '';
  page?: number;
  size?: number;
}

export interface MatchFormValue {
  tournamentId: number;
  stageId: number | null;
  groupId: number | null;
  roundNumber: number | null;
  matchdayNumber: number | null;
  homeTournamentTeamId: number;
  awayTournamentTeamId: number;
  scheduledAt: string | null;
  venueName: string | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  winnerTournamentTeamId: number | null;
  notes: string | null;
}

export type MatchPage = PageResponse<MatchGame>;
