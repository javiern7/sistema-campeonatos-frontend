import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export type ActionReasonDialogData = {
  title: string;
  description: string;
  confirmLabel: string;
  reasonLabel: string;
  defaultReason?: string;
};

export type ActionReasonDialogResult = {
  reason: string;
};

@Component({
  selector: 'app-action-reason-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="dialog-description">{{ data.description }}</p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>{{ data.reasonLabel }}</mat-label>
          <textarea matInput rows="3" formControlName="reason"></textarea>
          @if (form.controls.reason.hasError('required') && form.controls.reason.touched) {
            <mat-error>El motivo es obligatorio.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="confirm()">{{ data.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-description {
        margin-top: 0;
        color: var(--text-soft);
      }

      mat-form-field {
        width: 100%;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionReasonDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ActionReasonDialogComponent, ActionReasonDialogResult>);
  protected readonly data = inject<ActionReasonDialogData>(MAT_DIALOG_DATA);

  protected readonly form = this.fb.nonNullable.group({
    reason: [this.data.defaultReason ?? '', [Validators.required]]
  });

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.dialogRef.close({ reason: this.form.getRawValue().reason.trim() });
  }
}
