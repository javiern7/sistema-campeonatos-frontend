import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchSelectComponent),
      multi: true
    }
  ],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ label }}</mat-label>
      <mat-select
        [value]="innerValue"
        [disabled]="isDisabled"
        [panelClass]="'search-select-panel'"
        (selectionChange)="handleSelectionChange($event.value)"
        (openedChange)="handleOpenedChange($event)"
      >
        <mat-select-trigger>{{ selectedLabel() }}</mat-select-trigger>

        <mat-option disabled class="search-select-search-option">
          <div class="search-select-panel-header" (click)="$event.stopPropagation()">
            <mat-icon class="search-select-icon">search</mat-icon>
            <input
              #searchInput
              matInput
              type="text"
              [formControl]="searchControl"
              [placeholder]="placeholder"
              class="search-select-input"
              (click)="$event.stopPropagation()"
              (mousedown)="$event.stopPropagation()"
              (keydown)="$event.stopPropagation()"
            >
          </div>
        </mat-option>

        @if (emptyOptionLabel) {
          <mat-option [value]="emptyValue">{{ emptyOptionLabel }}</mat-option>
        }

        @for (option of filteredOptions; track trackByValue($index, option)) {
          <mat-option [value]="valueFn(option)">{{ optionLabel(option) }}</mat-option>
        }

        @if (filteredOptions.length === 0) {
          <mat-option disabled>{{ noResultsText }}</mat-option>
        }
      </mat-select>

      @if (hint) {
        <mat-hint>{{ hint }}</mat-hint>
      }
      @if (showError && errorText) {
        <mat-error>{{ errorText }}</mat-error>
      }
    </mat-form-field>
  `,
  styles: [`
    .search-select-panel {
      background: #ffffff !important;
    }

    .search-select-panel .mat-mdc-option {
      background: #ffffff !important;
      opacity: 1 !important;
    }

    .search-select-panel .mat-mdc-option .mdc-list-item__primary-text {
      color: #17212b !important;
    }

    .search-select-search-option {
      position: sticky;
      top: 0;
      z-index: 3;
      min-height: auto !important;
      height: auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }

    .search-select-search-option.mdc-list-item--disabled {
      opacity: 1 !important;
      cursor: default;
    }

    .search-select-search-option .mdc-list-item__primary-text {
      width: 100%;
      color: inherit !important;
    }

    .search-select-panel-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 0.65rem 0.65rem;
      background: #ffffff;
      width: 100%;
    }

    .search-select-icon {
      color: rgba(83, 98, 114, 0.9);
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }

    .search-select-input {
      width: 100%;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 8px;
      background: #ffffff;
      padding: 0.55rem 0.75rem;
      outline: none;
      color: #17212b;
    }

    .search-select-input:focus {
      border-color: rgba(10, 110, 90, 0.45);
      box-shadow: 0 0 0 3px rgba(10, 110, 90, 0.1);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class SearchSelectComponent implements ControlValueAccessor, OnChanges {
  @Input() label = '';
  @Input() placeholder = 'Escribe para buscar';
  @Input() hint = '';
  @Input() errorText = '';
  @Input() showError = false;
  @Input() emptyOptionLabel = '';
  @Input() emptyValue: string | number | null = '';
  @Input() noResultsText = 'No hay coincidencias';
  @Input() options: readonly any[] = [];
  @Input() labelFn: (option: any) => string = (option) => String(option ?? '');
  @Input() valueFn: (option: any) => string | number | null = (option) =>
    typeof option === 'object' && option !== null && 'id' in option ? Number((option as { id: unknown }).id) : String(option ?? '');
  @Input() searchTextFn: (option: any) => string = (option) => this.labelFn(option);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected filteredOptions: readonly any[] = [];
  protected innerValue: string | number | null = this.emptyValue;
  protected isDisabled = false;

  private onChange: (value: string | number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.searchControl.valueChanges.subscribe((value) => {
      this.applyFilter(value);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options'] || changes['labelFn'] || changes['searchTextFn']) {
      this.applyFilter(this.searchControl.getRawValue());
    }
  }

  writeValue(value: string | number | null): void {
    this.innerValue = value ?? this.emptyValue;
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  protected handleSelectionChange(value: string | number | null): void {
    this.innerValue = value;
    this.onChange(value);
    this.onTouched();
  }

  protected handleOpenedChange(isOpen: boolean): void {
    if (!isOpen) {
      this.onTouched();
      return;
    }

    this.searchControl.setValue('', { emitEvent: false });
    this.applyFilter('');
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  protected selectedLabel(): string {
    if (this.innerValue === null || this.innerValue === undefined || this.innerValue === '' || this.innerValue === 0) {
      return this.emptyOptionLabel || '';
    }

    const matchedOption = this.options.find((option) => this.valueFn(option) === this.innerValue);
    return matchedOption ? this.optionLabel(matchedOption) : '';
  }

  protected trackByValue(_: number, option: any): string {
    return String(this.valueFn(option));
  }

  protected optionLabel(option: any): string {
    return this.labelFn(option);
  }

  private applyFilter(rawValue: string): void {
    const search = normalizeText(rawValue ?? '');
    this.filteredOptions = this.options.filter((option) =>
      normalizeText(this.searchTextFn(option)).includes(search)
    );
  }
}
