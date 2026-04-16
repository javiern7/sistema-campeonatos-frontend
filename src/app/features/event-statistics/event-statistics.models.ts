export interface EventStatisticsFilters {
  matchId?: number | '';
  tournamentTeamId?: number | '';
  playerId?: number | '';
}

export interface EventStatisticsSummary {
  goals: number;
  yellowCards: number;
  redCards: number;
  activeEvents: number;
}

export interface EventStatisticsPlayer {
  playerId: number;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  tournamentTeamId: number | null;
  teamId: number | null;
  teamName: string | null;
  teamShortName: string | null;
  goals: number;
  yellowCards: number;
  redCards: number;
  activeEvents: number;
}

export interface EventStatisticsTeam {
  tournamentTeamId: number;
  teamId: number | null;
  teamName: string | null;
  teamShortName: string | null;
  teamCode: string | null;
  seedNumber: number | null;
  goals: number;
  yellowCards: number;
  redCards: number;
  activeEvents: number;
}

export interface EventStatisticsMatch {
  matchId: number;
  homeTournamentTeamId: number | null;
  awayTournamentTeamId: number | null;
  scheduledAt: string | null;
  goals: number;
  yellowCards: number;
  redCards: number;
  activeEvents: number;
}

export interface EventStatisticsTraceability {
  derivedFromMatchEvents: boolean;
  source: string | null;
  includedEventTypes: string[];
  excludedStatuses: string[];
  notes?: string[];
}

export interface EventStatisticsResponse {
  tournamentId: number;
  filters: {
    matchId: number | null;
    tournamentTeamId: number | null;
    teamId: number | null;
    playerId: number | null;
  };
  summary: EventStatisticsSummary;
  players: EventStatisticsPlayer[];
  teams: EventStatisticsTeam[];
  matches: EventStatisticsMatch[];
  traceability: EventStatisticsTraceability;
}
