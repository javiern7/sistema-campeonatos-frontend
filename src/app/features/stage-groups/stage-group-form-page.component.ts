import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ErrorMapper } from '../../core/error/error.mapper';
import { NotificationService } from '../../core/error/notification.service';
import { CatalogLoaderService } from '../../core/pagination/catalog-loader.service';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { TournamentStage } from '../tournament-stages/tournament-stage.models';
import { TournamentStagesService } from '../tournament-stages/tournament-stages.service';
import { StageGroupFormValue } from './stage-group.models';
import { StageGroupsService } from './stage-groups.service';

@Component({
  selector: 'app-stage-group-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    LoadingStateComponent,
    PageHeaderComponent
  ],
  template: `
    <section class="app-page">
      <app-page-header [title]="isEditMode() ? 'Editar grupo' : 'Nuevo grupo'" subtitle="Agrupacion por etapa." />

      <section class="card page-card">
        @if (pageLoading()) {
          <app-loading-state />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="app-page">
            <div class="form-grid">
              @if (!isEditMode()) {
                <mat-form-field appearance="outline">
                  <mat-label>Etapa</mat-label>
                  <mat-select formControlName="stageId">
                    @for (item of stages(); track item.id) {
                      <mat-option [value]="item.id">{{ item.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }

              <mat-form-field appearance="outline">
                <mat-label>Codigo</mat-label>
                <input matInput formControlName="code">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput formControlName="name">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Orden</mat-label>
                <input matInput type="number" formControlName="sequenceOrder">
              </mat-form-field>
            </div>

            <div class="form-actions">
              <a mat-stroked-button routerLink="/stage-groups">Cancelar</a>
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        }
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StageGroupFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stagesService = inject(TournamentStagesService);
  private readonly groupsService = inject(StageGroupsService);
  private readonly catalogLoader = inject(CatalogLoaderService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMapper = inject(ErrorMapper);

  protected readonly groupId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  protected readonly isEditMode = signal(this.groupId > 0);
  protected readonly pageLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly stages = signal<TournamentStage[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    stageId: [0],
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(50)]],
    sequenceOrder: [1, Validators.required]
  });

  constructor() {
    this.catalogLoader.loadAll((page, size) => this.stagesService.list({ page, size })).subscribe({
      next: (items) => {
        this.stages.set(items);
        if (!this.isEditMode() && items.length > 0) {
          this.form.patchValue({ stageId: items[0].id });
        }
      }
    });

    if (!this.isEditMode()) {
      this.pageLoading.set(false);
      return;
    }

    this.groupsService
      .getById(this.groupId)
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: (group) =>
          this.form.patchValue({
            stageId: group.stageId,
            code: group.code,
            name: group.name,
            sequenceOrder: group.sequenceOrder
          }),
        error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: StageGroupFormValue = {
      stageId: Number(value.stageId),
      code: value.code,
      name: value.name,
      sequenceOrder: Number(value.sequenceOrder)
    };

    this.saving.set(true);
    const request$ = this.isEditMode()
      ? this.groupsService.update(this.groupId, {
          code: payload.code,
          name: payload.name,
          sequenceOrder: payload.sequenceOrder
        })
      : this.groupsService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.success('Grupo guardado correctamente');
        void this.router.navigateByUrl('/stage-groups');
      },
      error: (error: unknown) => this.notifications.error(this.errorMapper.map(error).message)
    });
  }
}
