import { Provider } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';

const pad = (value: number): string => value.toString().padStart(2, '0');

export const parseBackendDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

export const toBackendDate = (value: Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

export const todayDateOnly = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

export const dateRangeValidator = (
  startControlName = 'startDate',
  endControlName = 'endDate',
  errorKey = 'dateRange'
): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    const startDate = control.get(startControlName)?.value as Date | null;
    const endDate = control.get(endControlName)?.value as Date | null;

    if (!startDate || !endDate) {
      return null;
    }

    return endDate < startDate ? { [errorKey]: true } : null;
  };
};

export class PichangaDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') {
      return value instanceof Date ? value : null;
    }

    const trimmed = value.trim();
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed);
    if (!match) {
      return super.parse(value);
    }

    const [, day, month, rawYear] = match;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === 'input') {
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    }

    return super.format(date, displayFormat);
  }
}

export const PICHANGA_DATE_FORMATS = {
  parse: {
    dateInput: 'input'
  },
  display: {
    dateInput: 'input',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'dd/MM/yyyy',
    monthYearA11yLabel: 'MMMM yyyy'
  }
};

export const PICHANGA_DATE_PICKER_PROVIDERS: Provider[] = [
  { provide: DateAdapter, useClass: PichangaDateAdapter },
  { provide: MAT_DATE_FORMATS, useValue: PICHANGA_DATE_FORMATS },
  { provide: MAT_DATE_LOCALE, useValue: 'es-PE' }
];
