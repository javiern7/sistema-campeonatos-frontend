import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { PublicMatchSummary, PublicTournamentCalendar } from './public-portal.models';

@Component({
  selector: 'app-calendar-section',
  standalone: true,
  template: `
    <section class="card public-card">
      <div class="section-heading">
        <div>
          <h2>Calendario</h2>
          <p class="muted">Partidos programados y cerrados devueltos por el contrato publico.</p>
        </div>
        @if (calendar) {
          <span class="meta-chip">{{ calendar.totalMatches }} partidos</span>
        }
      </div>

      @if (calendar?.matches?.length) {
        <div class="match-list">
          @for (match of calendar!.matches; track match.matchId) {
            <article class="match-row">
              <div>
                <strong>{{ teamLabel(match.homeTeam) }} vs {{ teamLabel(match.awayTeam) }}</strong>
                <p class="muted">{{ contextLabel(match) }}</p>
              </div>
              <div class="match-meta">
                <span class="status-chip">{{ statusLabel(match.status) }}</span>
                <span>{{ dateTimeLabel(match.scheduledAt) }}</span>
                <span>{{ match.venueName || 'Sede no publicada' }}</span>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state">
          <strong>No hay partidos en calendario.</strong>
          <p class="muted">El backend respondio correctamente, pero no hay partidos visibles para este torneo.</p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .public-card {
        padding: 1.5rem;
        border-radius: 8px;
      }

      .section-heading {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }

      h2,
      p {
        margin: 0;
      }

      .match-list {
        display: grid;
        gap: 0.75rem;
      }

      .match-row {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: minmax(0, 1fr) minmax(220px, auto);
        align-items: center;
        padding: 1rem;
        border: 1px solid rgba(23, 33, 43, 0.08);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.78);
      }

      .match-meta {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .meta-chip,
      .status-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.35rem 0.65rem;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .meta-chip {
        border: 1px solid rgba(23, 33, 43, 0.08);
      }

      .status-chip {
        background: rgba(10, 110, 90, 0.1);
        color: var(--primary);
      }

      @media (max-width: 640px) {
        .public-card {
          padding: 1rem;
        }

        .match-row {
          grid-template-columns: 1fr;
        }

        .match-meta {
          justify-content: flex-start;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarSectionComponent {
  @Input({ required: true }) calendar: PublicTournamentCalendar | null = null;

  protected teamLabel(team: PublicMatchSummary['homeTeam']): string {
    return team.shortName || team.teamName;
  }

  protected contextLabel(match: PublicMatchSummary): string {
    const context = [match.stageName, match.groupName, match.roundNumber ? `Ronda ${match.roundNumber}` : null]
      .filter(Boolean)
      .join(' / ');

    return context || 'Sin etapa publica';
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      SCHEDULED: 'Programado',
      IN_PROGRESS: 'En curso',
      PLAYED: 'Jugado',
      FORFEIT: 'W.O.',
      CANCELLED: 'Cancelado',
      POSTPONED: 'Postergado'
    };

    return labels[status] ?? status;
  }

  protected dateTimeLabel(value: string | null): string {
    const parsed = parseBackendDateTime(value);
    return parsed
      ? new Intl.DateTimeFormat('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(parsed)
      : 'Fecha por confirmar';
  }
}
