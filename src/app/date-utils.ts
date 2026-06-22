import { Timestamp } from '@angular/fire/firestore';
import {
  formatJapaneseDate,
  getAge,
  getAgeAttainmentYyyyMm,
  getCalendarDateInTimeZone,
  JAPAN_TIME_ZONE,
  japanCalendarDateToInstant,
  normalizeEffectiveFrom,
  toFormDate,
  toJapanCalendarDate,
  toYyyyMmDd,
} from '../../shared/date-utils';

export {
  formatJapaneseDate,
  getAge,
  getAgeAttainmentYyyyMm,
  getCalendarDateInTimeZone,
  JAPAN_TIME_ZONE,
  normalizeEffectiveFrom,
  toFormDate,
  toJapanCalendarDate,
  toYyyyMmDd,
};

/** JST 暦日を Firestore Timestamp として保存する。 */
export function toFirestoreTimestamp(date: Date | null | undefined): Timestamp | null {
  if (!date) {
    return null;
  }
  return Timestamp.fromDate(japanCalendarDateToInstant(date));
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
  const { year: minYear, month: minMonth } = parseYyyyMm(minYyyyMm);
  const { year: maxYear, month: maxMonth } = parseYyyyMm(maxYyyyMm);
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
