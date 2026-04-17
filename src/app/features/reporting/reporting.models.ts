export type ReportType = 'summary' | 'matches' | 'standings' | 'events' | 'scorers' | 'cards';
export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportingFilters {
  matchId?: number | '';
  tournamentTeamId?: number | '';
  playerId?: number | '';
  from?: string;
  to?: string;
}

export interface ReportingQueryParams {
  matchId?: number;
  tournamentTeamId?: number;
  playerId?: number;
  scheduledFrom?: string;
  scheduledTo?: string;
}

export interface ReportMetadata {
  reportType?: ReportType | string | null;
  generatedAt?: string | null;
  source?: string | null;
  message?: string | null;
}

export interface ReportTournamentRef {
  id?: number;
  name?: string | null;
  seasonName?: string | null;
}

export interface OperationalReport {
  metadata: ReportMetadata;
  tournament: ReportTournamentRef;
  filters: Record<string, unknown>;
  totals: Record<string, unknown>;
  rows: Record<string, unknown>[];
}

export interface ExportedReportFile {
  blob: Blob;
  fileName: string;
  contentType: string;
}
