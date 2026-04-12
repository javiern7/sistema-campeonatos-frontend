import { PageResponse } from '../../core/api/api.models';

export type MatchStatus = 'SCHEDULED' | 'PLAYED' | 'FORFEIT' | 'CANCELLED';
export type MatchEventType = 'SCORE' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'INCIDENT' | 'NOTE';
export type MatchEventStatus = 'ACTIVE' | 'ANNULLED';

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

export interface MatchEvent {
  id: number;
  matchId: number;
  tournamentId: number;
  eventType: MatchEventType;
  status: MatchEventStatus;
  tournamentTeamId: number | null;
  playerId: number | null;
  relatedPlayerId: number | null;
  periodLabel: string | null;
  eventMinute: number | null;
  eventSecond: number | null;
  eventValue: number | null;
  notes: string | null;
  createdByUserId: number | null;
  annulledByUserId: number | null;
  annulledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchEventFormValue {
  eventType: MatchEventType;
  tournamentTeamId: number | null;
  playerId: number | null;
  relatedPlayerId: number | null;
  periodLabel: string | null;
  eventMinute: number | null;
  eventSecond: number | null;
  eventValue: number | null;
  notes: string | null;
}

export interface AnnulMatchEventValue {
  notes: string | null;
}
