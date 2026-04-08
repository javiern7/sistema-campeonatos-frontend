import { MatchStatus } from '../matches/match.models';
import { TournamentStageType } from '../tournament-stages/tournament-stage.models';

export interface CompetitionAdvancedParticipant {
  tournamentTeamId?: number | null;
  teamId?: number | null;
  label?: string | null;
  teamName?: string | null;
}

export interface CompetitionAdvancedMatch {
  id: number;
  stageId: number | null;
  groupId: number | null;
  roundNumber: number | null;
  matchdayNumber: number | null;
  homeTournamentTeamId?: number | null;
  awayTournamentTeamId?: number | null;
  winnerTournamentTeamId?: number | null;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: string | null;
  venueName: string | null;
  status: MatchStatus;
  homeTeam?: CompetitionAdvancedParticipant | null;
  awayTeam?: CompetitionAdvancedParticipant | null;
  winnerTeam?: CompetitionAdvancedParticipant | null;
  affectsStandings?: boolean | null;
  standingScope?: string | null;
  standingStatus?: string | null;
}

export interface CompetitionAdvancedBracketRound {
  roundNumber: number;
  matches: CompetitionAdvancedMatch[];
}

export interface CompetitionAdvancedBracketResponse {
  tournamentId: number;
  stageId: number | null;
  stageName: string | null;
  stageType: TournamentStageType | null;
  totalMatches: number;
  rounds: CompetitionAdvancedBracketRound[];
}

export interface CompetitionAdvancedCalendarFilters {
  stageId?: number | '';
  groupId?: number | '';
  status?: MatchStatus | '';
  from?: string;
  to?: string;
}

export interface CompetitionAdvancedCalendarResponse {
  tournamentId: number;
  stageId?: number | null;
  groupId?: number | null;
  status?: MatchStatus | null;
  from?: string | null;
  to?: string | null;
  totalMatches: number;
  scheduledMatches: number;
  closedMatches: number;
  matches: CompetitionAdvancedMatch[];
}

export interface CompetitionAdvancedResultsFilters {
  stageId?: number | '';
  groupId?: number | '';
}

export interface CompetitionAdvancedResultsResponse {
  tournamentId: number;
  stageId?: number | null;
  groupId?: number | null;
  totalMatches: number;
  closedMatches?: number;
  matches: CompetitionAdvancedMatch[];
}
