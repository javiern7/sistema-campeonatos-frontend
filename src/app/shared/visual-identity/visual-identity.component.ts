import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type IdentityKind = 'team' | 'player';

@Component({
  selector: 'app-visual-identity',
  standalone: true,
  template: `
    <span class="identity" [class.compact]="compact()" [class.player]="kind() === 'player'">
      <span class="identity-mark" [style.--identity-primary]="primaryColor()" [style.--identity-secondary]="secondaryColor()">
        {{ initials() }}
      </span>
      <span class="identity-copy">
        <strong>{{ label() || fallbackLabel() }}</strong>
        @if (supportingLabel()) {
          <span class="muted">{{ supportingLabel() }}</span>
        }
      </span>
    </span>
  `,
  styles: [
    `
      .identity {
        display: inline-flex;
        min-width: 0;
        align-items: center;
        gap: 0.7rem;
      }

      .identity-mark {
        display: inline-flex;
        width: 2.35rem;
        height: 2.35rem;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background:
          linear-gradient(135deg, var(--identity-primary, #0a6e5a), var(--identity-secondary, #0e7490));
        color: #ffffff;
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
      }

      .identity.player .identity-mark {
        border-radius: 999px;
      }

      .identity-copy {
        display: grid;
        min-width: 0;
        gap: 0.12rem;
      }

      .identity-copy strong,
      .identity-copy span {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .identity-copy span {
        font-size: 0.86rem;
      }

      .identity.compact {
        gap: 0.5rem;
      }

      .identity.compact .identity-mark {
        width: 1.85rem;
        height: 1.85rem;
        font-size: 0.72rem;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisualIdentityComponent {
  readonly kind = input<IdentityKind>('team');
  readonly label = input('');
  readonly shortLabel = input<string | null>('');
  readonly code = input<string | null>('');
  readonly meta = input('');
  readonly primary = input<string | null>('');
  readonly secondary = input<string | null>('');
  readonly compact = input(false);

  protected readonly fallbackLabel = computed(() => (this.kind() === 'player' ? 'Jugador' : 'Equipo'));
  protected readonly supportingLabel = computed(() =>
    [this.shortLabel(), this.code(), this.meta()].filter((item) => Boolean(item)).join(' · ')
  );
  protected readonly initials = computed(() => {
    const preferred = this.shortLabel() || this.code();
    if (preferred) {
      return preferred.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'SC';
    }

    const initials = this.label()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();

    return initials || (this.kind() === 'player' ? 'JG' : 'EQ');
  });
  protected readonly primaryColor = computed(() => this.safeColor(this.primary()) || this.deterministicColor(this.label(), 0));
  protected readonly secondaryColor = computed(() => this.safeColor(this.secondary()) || this.deterministicColor(this.label(), 1));

  private safeColor(value: string | null): string {
    const color = (value ?? '').trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : '';
  }

  private deterministicColor(seed: string, offset: number): string {
    const palette = ['#0a6e5a', '#0e7490', '#7c2d12', '#4338ca', '#be123c', '#166534', '#854d0e'];
    const sum = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palette[(sum + offset) % palette.length];
  }
}
