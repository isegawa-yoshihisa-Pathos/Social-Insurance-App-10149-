import { CURRENT_GRADE_TABLE, resolveGradesFromRemuneration } from './grade-table';
import type { RemunerationGradeTableSet, ResolvedStandardRemuneration } from './grade-table';
import { classifyPaymentBaseDaysTier, type EmploymentType } from './payment-base-days';
import type { MonthlyRemunerationSource } from './remuneration-month-input';
import {
  evaluateStandardZuijiApplicability,
  getGradeTableLimits,
  type PreviousGrades,
  type StandardZuijiApplicability,
} from './zuiji-determination';

export interface MayJuneZuijiSchedule {
  raiseMonthYyyyMm: string;
  /** 単月スクリーニング・通知を行う月（昇給月+2） */
  screeningYyyyMm: string;
  /** 3ヶ月平均による随時改定の適用開始月（昇給月+3） */
  effectiveYyyyMm: string;
}

/** yyyyMm に +n ヶ月（YYYY-MM 形式） */
export function addYyyyMm(yyyyMm: string, delta: number): string {
  const year = Number(yyyyMm.slice(0, 4));
  const month = Number(yyyyMm.slice(5, 7));
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthFromYyyyMm(yyyyMm: string): number {
  return Number(yyyyMm.slice(5, 7));
}

export function isMayOrJuneRaiseMonth(yyyyMm: string): boolean {
  const month = parseMonthFromYyyyMm(yyyyMm);
  return month === 5 || month === 6;
}

export function getMayJuneZuijiSchedule(raiseMonthYyyyMm: string): MayJuneZuijiSchedule {
  return {
    raiseMonthYyyyMm,
    screeningYyyyMm: addYyyyMm(raiseMonthYyyyMm, 2),
    effectiveYyyyMm: addYyyyMm(raiseMonthYyyyMm, 3),
  };
}

export function computeTotalRemunerationFromMonthlySource(
  source: MonthlyRemunerationSource,
): number {
  const fixed = source.payroll.fixedWage ?? source.payroll.basicSalary ?? 0;
  const variable = source.payroll.variableWage ?? 0;
  return fixed + variable;
}

export function resolveGradesFromMonthlySource(
  employmentType: EmploymentType,
  source: MonthlyRemunerationSource,
  gradeTable: RemunerationGradeTableSet = CURRENT_GRADE_TABLE,
): ResolvedStandardRemuneration | null {
  const tier = classifyPaymentBaseDaysTier(employmentType, source.paymentBaseDays);
  if (tier === 'none') return null;
  return resolveGradesFromRemuneration(
    gradeTable,
    computeTotalRemunerationFromMonthlySource(source),
  );
}

export type MayJuneZuijiScreeningOutcome =
  | {
      kind: 'candidate';
      grades: ResolvedStandardRemuneration;
      applicability: StandardZuijiApplicability;
      schedule: MayJuneZuijiSchedule;
    }
  | {
      kind: 'not_candidate';
      reason: 'not_may_june' | 'insufficient_payment_base_days' | 'grade_not_found' | 'insufficient_grade_change';
      schedule?: MayJuneZuijiSchedule;
    };

/**
 * 5月・6月昇給の単月報酬で等級を試算し、随時改定候補か判定する（適用はしない）。
 */
export function screenMayJuneZuijiFromSingleMonth(
  employmentType: EmploymentType,
  raiseMonthSource: MonthlyRemunerationSource,
  previous: PreviousGrades,
  options?: { gradeTable?: RemunerationGradeTableSet; minGradeDifference?: number },
): MayJuneZuijiScreeningOutcome {
  if (!isMayOrJuneRaiseMonth(raiseMonthSource.yyyyMm)) {
    return { kind: 'not_candidate', reason: 'not_may_june' };
  }

  const schedule = getMayJuneZuijiSchedule(raiseMonthSource.yyyyMm);
  const gradeTable = options?.gradeTable ?? CURRENT_GRADE_TABLE;
  const grades = resolveGradesFromMonthlySource(
    employmentType,
    raiseMonthSource,
    gradeTable,
  );

  if (!grades) {
    const tier = classifyPaymentBaseDaysTier(
      employmentType,
      raiseMonthSource.paymentBaseDays,
    );
    if (tier === 'none') {
      return { kind: 'not_candidate', reason: 'insufficient_payment_base_days', schedule };
    }
    return { kind: 'not_candidate', reason: 'grade_not_found', schedule };
  }

  const limits = getGradeTableLimits(gradeTable);
  const applicability = evaluateStandardZuijiApplicability(
    previous,
    grades,
    limits,
    options?.minGradeDifference ?? 2,
  );

  if (!applicability.applicable) {
    return { kind: 'not_candidate', reason: 'insufficient_grade_change', schedule };
  }

  return { kind: 'candidate', grades, applicability, schedule };
}

/** 通知文用: 適用開始月の表示 */
export function formatZuijiEffectiveMonthLabel(effectiveYyyyMm: string): string {
  const month = parseMonthFromYyyyMm(effectiveYyyyMm);
  return `${month}月`;
}

export function buildMayJuneZuijiPendingNotificationBody(
  employeeName: string,
  raiseMonthYyyyMm: string,
  effectiveYyyyMm: string,
): string {
  const raiseMonth = parseMonthFromYyyyMm(raiseMonthYyyyMm);
  const effectiveLabel = formatZuijiEffectiveMonthLabel(effectiveYyyyMm);
  return (
    `${employeeName}様は${raiseMonth}月に固定的賃金の変動がありました。` +
    `単月の報酬で試算した結果、随時改定の要件を満たす可能性があります。` +
    `${effectiveLabel}（${effectiveYyyyMm}）からの随時改定適用をご確認ください。` +
    `定時決定の届出は不要です。`
  );
}
