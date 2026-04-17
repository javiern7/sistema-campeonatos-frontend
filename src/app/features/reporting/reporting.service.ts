import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, mergeMap, throwError } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import { AppError } from '../../core/error/app-error.model';
import {
  ExportedReportFile,
  OperationalReport,
  ReportFormat,
  ReportType,
  ReportingFilters,
  ReportingQueryParams
} from './reporting.models';

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly api = inject(ApiClientService);

  getReport(tournamentId: number, reportType: ReportType, filters: ReportingFilters): Observable<OperationalReport> {
    return this.api.get<OperationalReport>(`/tournaments/${tournamentId}/reports/${reportType}`, this.toBackendFilters(filters));
  }

  exportReport(
    tournamentId: number,
    reportType: ReportType,
    format: ReportFormat,
    filters: ReportingFilters
  ): Observable<ExportedReportFile> {
    return this.api
      .download(`/tournaments/${tournamentId}/reports/export`, { reportType, format, ...this.toBackendFilters(filters) })
      .pipe(
        map((blob) => ({
          blob,
          fileName: `torneo-${tournamentId}-${reportType}.${format}`,
          contentType: blob.type || this.contentType(format)
        })),
        catchError((error: unknown) => this.mapDownloadError(error))
      );
  }

  private toBackendFilters(filters: ReportingFilters): ReportingQueryParams {
    return {
      ...(filters.matchId ? { matchId: Number(filters.matchId) } : {}),
      ...(filters.tournamentTeamId ? { tournamentTeamId: Number(filters.tournamentTeamId) } : {}),
      ...(filters.playerId ? { playerId: Number(filters.playerId) } : {}),
      ...(filters.from ? { scheduledFrom: this.startOfDay(filters.from) } : {}),
      ...(filters.to ? { scheduledTo: this.endOfDay(filters.to) } : {})
    };
  }

  private startOfDay(value: string): string {
    return `${value}T00:00:00-05:00`;
  }

  private endOfDay(value: string): string {
    return `${value}T23:59:59-05:00`;
  }

  private mapDownloadError(error: unknown): Observable<never> {
    if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
      return throwError(() => error);
    }

    return from(error.error.text()).pipe(
      mergeMap((text) => {
        try {
          const payload = JSON.parse(text) as { message?: string; code?: string; errors?: unknown };
          return throwError(
            () => new AppError(error.status, payload.message ?? 'No se pudo descargar el reporte', payload.code, payload.errors)
          );
        } catch {
          return throwError(() => error);
        }
      })
    );
  }

  private contentType(format: ReportFormat): string {
    const types: Record<ReportFormat, string> = {
      csv: 'text/csv;charset=UTF-8',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf'
    };

    return types[format];
  }
}
