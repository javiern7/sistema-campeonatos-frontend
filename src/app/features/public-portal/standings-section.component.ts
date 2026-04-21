import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { VisualIdentityComponent } from '../../shared/visual-identity/visual-identity.component';
import { PublicTournamentStandings } from './public-portal.models';

@Component({
  selector: 'app-standings-section',
  standalone: true,
  imports: [VisualIdentityComponent],
  template: `
    <section class="card public-card">
      <div class="section-heading">
        <div>
          <h2>Tabla publica</h2>
          <p class="muted">{{ standingsContextLabel() }}</p>
        </div>
        @if (standings) {
          <span class="meta-chip">{{ standings.totalEntries }} entradas</span>
        }
      </div>

      @if (standings?.standings?.length) {
        <div class="table-wrapper">
          <table class="public-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Equipo</th>
                <th>PJ</th>
                <th>PG</th>
                <th>PE</th>
                <th>PP</th>
                <th>DG</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of standings!.standings; track entry.position + '-' + entry.teamName) {
                <tr>
                  <td>
                    <span class="position-pill" [class.leader]="entry.position === 1">{{ entry.position }}</span>
                  </td>
                  <td>
                    <app-visual-identity
                      [label]="entry.teamName"
                      [shortLabel]="entry.teamShortName"
                      [code]="entry.teamCode"
                      [meta]="entry.scoreDiff > 0 ? 'DG +' + entry.scoreDiff : 'DG ' + entry.scoreDiff"
                      [compact]="true"
                    />
                  </td>
                  <td>{{ entry.played }}</td>
                  <td>{{ entry.wins }}</td>
                  <td>{{ entry.draws }}</td>
                  <td>{{ entry.losses }}</td>
                  <td>{{ entry.scoreDiff }}</td>
                  <td>{{ entry.points }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="empty-state">
          <strong>No hay standings publicados aun.</strong>
          <p class="muted">El backend devolvio una lectura valida, pero sin entradas visibles para este contexto.</p>
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

      .public-table {
        width: 100%;
        min-width: 620px;
        border-collapse: collapse;
      }

      .table-wrapper {
        max-width: 100%;
        overflow-x: auto;
      }

      .public-table th,
      .public-table td {
        padding: 0.8rem 0.75rem;
        border-bottom: 1px solid rgba(23, 33, 43, 0.08);
        text-align: left;
      }

      .position-pill {
        display: inline-flex;
        width: 2rem;
        height: 2rem;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background: #e0f2fe;
        color: #075985;
        font-weight: 800;
      }

      .position-pill.leader {
        background: #fef3c7;
        color: #92400e;
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

      @media (max-width: 640px) {
        .public-card {
          padding: 1rem;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StandingsSectionComponent {
  @Input({ required: true }) standings: PublicTournamentStandings | null = null;

  protected standingsContextLabel(): string {
    if (!this.standings) {
      return 'Cargando contexto de standings...';
    }

    const context = [this.standings.stageName, this.standings.groupName].filter(Boolean).join(' / ');
    return context || 'Lectura consolidada sin filtro adicional de etapa o grupo.';
  }
}
