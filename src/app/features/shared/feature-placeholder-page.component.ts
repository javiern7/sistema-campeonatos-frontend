import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

@Component({
  selector: 'app-feature-placeholder-page',
  standalone: true,
  imports: [PageHeaderComponent, MatButtonModule, RouterLink],
  template: `
    <section class="app-page">
      <app-page-header
        [title]="featureName"
        subtitle="Modulo reservado para una proxima mejora del producto."
      />

      <div class="card placeholder-box">
        <p>Esta pantalla todavia esta simplificada y se completara en una siguiente fase.</p>
        <a mat-flat-button color="primary" routerLink="/dashboard">Volver al inicio</a>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeaturePlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly featureName = String(this.route.snapshot.data['featureName'] ?? 'Modulo');
}
