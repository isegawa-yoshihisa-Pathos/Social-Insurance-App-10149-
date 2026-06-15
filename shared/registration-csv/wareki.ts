export type WarekiEraCode = '1' | '3' | '5' | '7' | '9';

export interface WarekiParts {
  era: WarekiEraCode;
  year: number;
  month: number;
  day: number;
}

const ERA_STARTS: { era: WarekiEraCode; year: number; month: number; day: number }[] = [
  { era: '9', year: 2019, month: 5, day: 1 },
  { era: '7', year: 1989, month: 1, day: 8 },
  { era: '5', year: 1926, month: 12, day: 25 },
  { era: '3', year: 1912, month: 7, day: 30 },
  { era: '1', year: 1868, month: 1, day: 25 },
];

export function toWarekiParts(date: Date): WarekiParts | null {
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  for (const start of ERA_STARTS) {
    const eraStart = new Date(start.year, start.month - 1, start.day).getTime();
    if (time < eraStart) {
      continue;
    }
    return {
      era: start.era,
      year: date.getFullYear() - start.year + 1,
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
  return null;
}

export function toWarekiYymmdd(date: Date): { era: WarekiEraCode; yymmdd: string } | null {
  const parts = toWarekiParts(date);
  if (!parts) {
    return null;
  }
  return {
    era: parts.era,
    yymmdd: [
      String(parts.year).padStart(2, '0'),
      String(parts.month).padStart(2, '0'),
      String(parts.day).padStart(2, '0'),
    ].join(''),
  };
}

export function toWarekiYearMonth(yyyyMm: string): { era: WarekiEraCode; year: string; month: string } | null {
  const year = Number(yyyyMm.slice(0, 4));
  const month = Number(yyyyMm.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  const parts = toWarekiParts(new Date(year, month - 1, 1));
  if (!parts) {
    return null;
  }
  return {
    era: parts.era,
    year: String(parts.year).padStart(2, '0'),
    month: String(month).padStart(2, '0'),
  };
}
