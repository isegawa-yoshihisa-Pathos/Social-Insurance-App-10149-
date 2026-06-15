export function csvField(value: string | number | null | undefined): string {
  if (value == null) {
    return '';
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function joinCsvRecord(fields: readonly (string | number)[]): string {
  return fields.map((field) => csvField(field)).join(',');
}

export function clampAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }
  if (amount >= 10_000_000) {
    return 9_999_999;
  }
  return Math.floor(amount);
}

export function formatAmountField(amount: number): string {
  return String(clampAmount(amount));
}

export function formatPaymentBaseDays(days: number): string {
  const normalized = Math.max(0, Math.min(31, Math.floor(days)));
  return String(normalized).padStart(2, '0');
}

export function splitBasicPensionNumber(value: string): { office: string; serial: string } {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) {
    return { office: '', serial: '' };
  }
  return { office: digits.slice(0, 4), serial: digits.slice(4, 10) };
}

export function formatEmployeeKanaName(realName: {
  lastNameKana?: string;
  firstNameKana?: string;
}): string {
  const last = (realName.lastNameKana ?? '').trim();
  const first = (realName.firstNameKana ?? '').trim();
  if (!last && !first) {
    return '';
  }
  return `${last} ${first}`.trim();
}

export function formatEmployeeKanjiName(realName: {
  lastName?: string;
  firstName?: string;
}): string {
  const last = (realName.lastName ?? '').trim();
  const first = (realName.firstName ?? '').trim();
  if (!last && !first) {
    return '';
  }
  return `${last}　${first}`.trim();
}

export function formatPayMonth(yyyyMm: string): string {
  return yyyyMm.slice(5, 7);
}
