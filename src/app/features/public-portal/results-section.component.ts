import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { parseBackendDateTime } from '../../shared/date/date-time.utils';
import { VisualIdentityComponent } from '../../shared/visual-identity/visual-identity.component';
import { PublicMatchStatus, PublicTournamentResultEntry, PublicTournamentResults } from './public-portal.models';

@Component({
  selector: 'app-results-section',
  standalone: true,
  imports: [VisualIdentityComponent],
  template: `
    <section class="card public-card">
      <div class="section-heading">
        <div>
          <h2>Resultados publicados</h2>
          <p class="muted">Marcadores cerrados para seguir el avance del campeonato.</p>
        </div>
        @if (results) {
          <span class="meta-chip">{{ results.totalClosedMatches }} cerrados</span>
        }
      </div>

      @if (results?.results?.length) {
        <div class="results-grid">
          @for (entry of results!.results; track entry.match.matchId) {
            <article class="result-card">
              <div class="card-head">
                <span class="meta-chip">{{ entry.match.stageName || 'Etapa por confirmar' }}</span>
                <span class="meta-chip" [class]="matchStatusClass(entry.match.status)">{{ matchStatusLabel(entry.match.status) }}</span>
              </div>
              <div class="scoreboard">
                <app-visual-identity
                  [label]="entry.match.homeTeam.teamName"
                  [shortLabel]="entry.match.homeTeam.shortName"
                  [code]="entry.match.homeTeam.code"
                  [compact]="true"
                />
                <strong class="score-value">{{ scoreLabel(entry) }}</strong>
                <app-visual-identity
                  [label]="entry.match.awayTeam.teamName"
                  [shortLabel]="entry.match.awayTeam.shortName"
                  [code]="entry.match.awayTeam.code"
                  [compact]="true"
                />
              </div>
              <p class="muted">{{ scopeLabel(entry) }}</p>
              <p class="muted">{{ scheduleLabel(entry) }}</p>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state">
          <strong>Aun no hay resultados.</strong>
          <p class="muted">Los marcadores apareceran cuando se registren partidos finalizados.</p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .public-card {
        min-width: 0;
        padding: 1.5rem;
        border-radius: 8px;
      }

      .section-heading,
      .card-head {
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

      .results-grid,
      .result-card {
        display: grid;
        gap: 0.85rem;
      }

      .results-grid {
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      }

      .result-card {
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid rgba(23, 33, 43, 0.08);
        background: rgba(255, 255, 255, 0.78);
      }

      .scoreboard {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
      }

      .score-value {
        display: inline-flex;
        min-width: 4.5rem;
        justify-content: center;
        padding: 0.45rem 0.65rem;
        border-radius: 8px;
        background: rgba(10, 110, 90, 0.1);
        color: var(--primary);
      }

      .meta-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.4rem 0.7rem;
        border: 1px solid rgba(23, 33, 43, 0.08);
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .meta-chip.played {
        background: #dcfce7;
        color: #166534;
      }

      .meta-chip.cancelled {
        background: #fee2e2;
        color: #b91c1c;
      }

      .meta-chip.forfeit {
        background: #fef3c7;
        color: #92400e;
      }

      @media (max-width: 640px) {
        .public-card {
          padding: 1rem;
        }

        .scoreboard {
          grid-template-columns: 1fr;
        }

        .score-value {
          width: 100%;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsSectionComponent {
  @Input({ required: true }) results: PublicTournamentResults | null = null;

  protected scoreLabel(entry: PublicTournamentResultEntry): string {
    const { homeScore, awayScore } = entry.match;
    return homeScore !== null && awayScore !== null ? `${homeScore} - ${awayScore}` : 'Marcador no disponible';
  }

  protected scopeLabel(entry: PublicTournamentResultEntry): string {
    return entry.affectsStandings ? `Cuenta para la tabla (${this.standingScopeLabel(entry.standingScope)})` : 'Resultado informativo';
  }

  protected matchStatusLabel(status: PublicMatchStatus | null): string {
    if (!status) {
      return 'Estado no disponible';
    }

    const labels: Partial<Record<PublicMatchStatus, string>> = {
      SCHEDULED: 'Programado',
      IN_PROGRESS: 'En curso',
      PLAYED: 'Jugado',
      FORFEIT: 'Resultado por ausencia',
      CANCELLED: 'Cancelado',
      POSTPONED: 'Reprogramado'
    };

    return labels[status] ?? status;
  }

  protected matchStatusClass(status: PublicMatchStatus | null): string {
    return status ? status.toLowerCase().replace('_', '-') : '';
  }

  private standingScopeLabel(scope: string | null): string {
    const labels: Record<string, string> = {
      LEAGUE: 'liga',
      STAGE: 'etapa',
      GROUP: 'grupo',
      TOURNAMENT: 'campeonato'
    };

    return scope ? (labels[scope] ?? scope.toLowerCase()) : 'sin alcance';
  }

  protected scheduleLabel(entry: PublicTournamentResultEntry): string {
    if (entry.match.scheduledAt) {
      return `Programado ${this.dateTimeLabel(entry.match.scheduledAt)}`;
    }

    return entry.match.venueName || 'Fecha y sede no publicadas';
  }

  private dateTimeLabel(value: string): string {
    const parsed = parseBackendDateTime(value);
    return parsed
      ? new Intl.DateTimeFormat('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(parsed)
      : 'sin dato';
  }
}
