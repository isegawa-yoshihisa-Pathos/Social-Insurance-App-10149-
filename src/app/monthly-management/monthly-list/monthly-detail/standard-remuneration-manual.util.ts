import {
  CURRENT_GRADE_TABLE,
  resolveGradeFromStandardAmount,
} from '../../../social-insurance/remuneration/grade-table';
import { StandardRemunerationSavePayload } from '../../../social-insurance/monthly/standard-remuneration-data.service';

export function tryResolveManualGrades(
  standardRemunerationHealth: number,
  standardRemunerationPension: number,
): { healthGrade: number; pensionGrade: number } | null {
  try {
    return {
      healthGrade: resolveManualGrade(CURRENT_GRADE_TABLE.health, standardRemunerationHealth),
      pensionGrade: resolveManualGrade(CURRENT_GRADE_TABLE.pension, standardRemunerationPension),
    };
  } catch {
    return null;
  }
}

export function buildManualStandardRemunerationPayload(input: {
  effectiveFrom: string;
  standardRemunerationHealth: number;
  standardRemunerationPension: number;
  remuneration?: number | null;
}): StandardRemunerationSavePayload {
  const grades = tryResolveManualGrades(
    input.standardRemunerationHealth,
    input.standardRemunerationPension,
  );
  if (!grades) {
    throw new Error('等級表に該当しない標準報酬月額です。');
  }

  return {
    healthGrade: grades.healthGrade,
    pensionGrade: grades.pensionGrade,
    standardRemuneration: {
      health: input.standardRemunerationHealth,
      pension: input.standardRemunerationPension,
    },
    source: 'manual',
    effectiveFrom: input.effectiveFrom,
    remuneration: input.remuneration ?? undefined,
  };
}

function resolveManualGrade(
  rows: typeof CURRENT_GRADE_TABLE.health,
  standardAmount: number,
): number {
  if (standardAmount <= 0) {
    throw new Error('標準報酬月額は1円以上で入力してください。');
  }
  const grade = resolveGradeFromStandardAmount(rows, standardAmount);
  if (grade != null) {
    return grade;
  }
  throw new Error('等級表に該当しない標準報酬月額です。');
}

export function parseYyyyMm(yyyyMm: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function toYyyyMm(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
