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

/** JST 暦日を、その日 JST 0:00 に相当する UTC instant に変換する（Firestore 保存用）。 */
export function japanCalendarDateToInstant(calendarDate: Date): Date {
  const normalized = getCalendarDateInTimeZone(JAPAN_TIME_ZONE, calendarDate);
  const y = normalized.getFullYear();
  const mo = normalized.getMonth();
  const d = normalized.getDate();
  return new Date(Date.UTC(y, mo, d) - 9 * 60 * 60 * 1000);
}

export function toYyyyMmDd(date: Date): string {
  const normalized = getCalendarDateInTimeZone(JAPAN_TIME_ZONE, date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatJapaneseDate(date: Date | null | undefined): string {
  if (!date) {
    return '';
  }
  const normalized = getCalendarDateInTimeZone(JAPAN_TIME_ZONE, date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

export function getAge(
  birthDate: Date | null | undefined,
  asOf: Date = new Date(),
): number {
  if (!birthDate) {
    return 0;
  }
  const birth = getCalendarDateInTimeZone(JAPAN_TIME_ZONE, birthDate);
  const today = getCalendarDateInTimeZone(JAPAN_TIME_ZONE, asOf);
  let age = today.getFullYear() - birth.getFullYear();

  const currentMonth = today.getMonth();
  const birthMonth = birth.getMonth();
  if (currentMonth < birthMonth) {
    age -= 1;
  } else if (currentMonth === birthMonth) {
    const currentDay = today.getDate();
    const birthDay = birth.getDate();
    if (currentDay < birthDay) {
      age -= 1;
    }
  }
  return age;
}

export function normalizeEffectiveFrom(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = toFormDate(value);
  return date ? toYyyyMmDd(date) : '';
}
