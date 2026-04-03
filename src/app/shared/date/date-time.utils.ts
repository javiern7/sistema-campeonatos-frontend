const pad = (value: number): string => value.toString().padStart(2, '0');

export const parseBackendDateTime = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toIsoFromDateTimeLocalInput = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) {
    return null;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  const localDate = new Date(year, month - 1, day, hours, minutes);

  return Number.isNaN(localDate.getTime()) ? null : localDate.toISOString();
};

export const toDateTimeLocalInputValue = (value: string | null | undefined): string => {
  const parsed = parseBackendDateTime(value);
  if (!parsed) {
    return '';
  }

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};
