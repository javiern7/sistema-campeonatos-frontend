export type DisciplinaryIncidentType = 'AMONESTACION' | 'EXPULSION' | 'INFORME_DISCIPLINARIO_SIMPLE';

export type DisciplinarySanctionType = 'ANOTACION_DISCIPLINARIA' | 'SUSPENSION_PROXIMO_PARTIDO';

export type DisciplinarySanctionStatus = 'ACTIVE' | 'SERVED' | 'CANCELLED' | string;

export interface DisciplineMatchContext {
  id?: number;
  matchId?: number;
  tournamentId?: number;
  homeTournamentTeamId?: number;
  awayTournamentTeamId?: number;
  status?: string;
}

export interface DisciplineTeamContext {
  tournamentTeamId?: number;
  teamId?: number;
  name?: string | null;
  teamName?: string | null;
  label?: string | null;
}

export interface DisciplinaryIncident {
  incidentId: number;
  matchId: number;
  tournamentId: number;
  tournamentTeamId: number;
  playerId: number;
  playerName: string | null;
  incidentType: DisciplinaryIncidentType | string;
  incidentMinute: number | null;
  notes: string | null;
  createdAt: string;
}

export interface DisciplinarySanction {
  sanctionId: number;
  incidentId: number;
  matchId?: number | null;
  tournamentId?: number | null;
  playerId: number;
  playerName: string | null;
  tournamentTeamId: number;
  sanctionType: DisciplinarySanctionType | string;
  status: DisciplinarySanctionStatus;
  matchesToServe: number;
  matchesServed: number;
  remainingMatches: number;
  createdAt: string;
  incidentType?: DisciplinaryIncidentType | string | null;
  incidentMinute?: number | null;
  notes?: string | null;
}

export interface DisciplineTraceability {
  matchDerivedFrom: string | null;
  rosterValidationMode: string | null;
  availabilityMode: string | null;
}

export interface DisciplineMatchResponse {
  match: DisciplineMatchContext | null;
  homeTeam: DisciplineTeamContext | null;
  awayTeam: DisciplineTeamContext | null;
  incidents: DisciplinaryIncident[];
  sanctions: DisciplinarySanction[];
  traceability: DisciplineTraceability | null;
}

export interface DisciplinaryIncidentCreateRequest {
  tournamentTeamId: number;
  playerId: number;
  incidentType: DisciplinaryIncidentType;
  incidentMinute: number | null;
  notes: string | null;
}

export interface DisciplinarySanctionCreateRequest {
  sanctionType: DisciplinarySanctionType;
  matchesToServe: number;
  notes: string | null;
}

export interface DisciplinarySanctionFilters {
  status?: DisciplinarySanctionStatus | '';
  teamId?: number | '';
  playerId?: number | '';
  matchId?: number | '';
  activeOnly?: boolean | '';
}

export interface DisciplinarySanctionListResponse {
  tournamentId: number;
  totalSanctions: number;
  sanctions: DisciplinarySanction[];
}
