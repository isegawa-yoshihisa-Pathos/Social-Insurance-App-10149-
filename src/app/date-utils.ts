import { Timestamp } from '@angular/fire/firestore';

export function toFormDate(value: unknown): Date | null {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as Timestamp).toDate === 'function'
  ) {
    return (value as Timestamp).toDate();
  }
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function getAge(birthDate: Date | null | undefined): number {
  if (!birthDate) {
    return 0;
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const currentMonth = today.getMonth();
  const birthMonth = birthDate.getMonth();
  if (currentMonth < birthMonth) {
    age -= 1;
  } else if (currentMonth === birthMonth) {
    const currentDay = today.getDate();
    const birthDay = birthDate.getDate();
    if (currentDay < birthDay) {
      age -= 1;
    }
  }
  return age;
}

export function toFirestoreTimestamp(date: Date | null | undefined): Timestamp | null {
  if (!date) {
    return null;
  }
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Timestamp.fromDate(normalized);
}

export function toYyyyMmDd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeEffectiveFrom(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = toFormDate(value);
  return date ? toYyyyMmDd(date) : '';
}

export function formatJapaneseDate(date: Date | null | undefined): string {
  if (!date) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

export function parseYyyyMm(yyyyMm: string): { year: number; month: number } {
  const year = Number(yyyyMm.slice(0, 4));
  const month = Number(yyyyMm.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid yyyyMm: ${yyyyMm}`);
  }
  return { year, month };
}

export function getTargetMonths(minYyyyMm: string, maxYyyyMm: string): string[] {
  const {year: minYear, month: minMonth} = parseYyyyMm(minYyyyMm);
  const {year: maxYear, month: maxMonth} = parseYyyyMm(maxYyyyMm);
  const months = [];
  for (let year = minYear; year <= maxYear; year++) {
    const startMonth = year === minYear ? minMonth : 1;
    const endMonth = year === maxYear ? maxMonth : 12;
    for (let month = startMonth; month <= endMonth; month++) {
      months.push(`${year}-${String(month).padStart(2, '0')}`);
    }
  }
  return months;
}