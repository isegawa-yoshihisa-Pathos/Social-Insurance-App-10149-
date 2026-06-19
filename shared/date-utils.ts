export const JAPAN_TIME_ZONE = 'Asia/Tokyo';

export function getCalendarDateInTimeZone(
  timeZone: string,
  date: Date = new Date(),
): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = formatter.format(date).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseToDateInstant(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
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

/** Firestore の瞬時刻などを日本の暦日（JST）として解釈した Date に変換する。 */
export function toJapanCalendarDate(value: unknown): Date | null {
  const instant = parseToDateInstant(value);
  if (!instant) return null;
  return getCalendarDateInTimeZone(JAPAN_TIME_ZONE, instant);
}

/** 暦日フィールドの読み取り用。常に JST 暦日として正規化する。 */
export function toFormDate(value: unknown): Date | null {
  return toJapanCalendarDate(value);
}

export function getAgeAttainmentYyyyMm(birthDate: Date, age: number): string {
  const normalized = getCalendarDateInTimeZone(JAPAN_TIME_ZONE, birthDate);
  const birthdayOfAge = new Date(
    normalized.getFullYear() + age,
    normalized.getMonth(),
    normalized.getDate(),
  );

  const attainmentDate = new Date(birthdayOfAge);
  attainmentDate.setDate(birthdayOfAge.getDate() - 1);

  const yyyy = attainmentDate.getFullYear();
  const mm = String(attainmentDate.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function checkLicense(params: {
  licenseStartAt: Date | null | undefined;
  yyyyMm: string;
}): boolean {
  const { licenseStartAt, yyyyMm } = params;
  if (!licenseStartAt) return false;
  const normalized = getCalendarDateInTimeZone(JAPAN_TIME_ZONE, licenseStartAt);
  const licenseStartAtYyyyMm = `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}`;
  if (licenseStartAtYyyyMm > yyyyMm) return false;
  return true;
}
