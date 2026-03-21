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
        subtitle="Feature reservada y alineada con el backend. Queda lista para el siguiente corte de implementación."
      />

      <div class="card placeholder-box">
        <p>Esta pantalla todavía está simplificada para avanzar más rápido en el MVP.</p>
        <a mat-flat-button color="primary" routerLink="/dashboard">Volver al dashboard</a>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeaturePlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly featureName = String(this.route.snapshot.data['featureName'] ?? 'Feature');
}
