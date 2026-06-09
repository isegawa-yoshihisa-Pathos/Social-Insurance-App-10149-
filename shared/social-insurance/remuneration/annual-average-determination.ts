import type { PayrollData } from '../../monthly-document';
import { addMonths } from '../monthly/social-insurance-data.util';
import {
  CURRENT_GRADE_TABLE,
  gradeDifference,
  resolveGradesFromRemuneration,
} from './grade-table';
import type { RemunerationGradeTableSet, ResolvedStandardRemuneration } from './grade-table';
import { getPaymentBaseDaysThresholds, type EmploymentType } from './payment-base-days';
import {
  evaluateStandardZuijiApplicability,
  getGradeTableLimits,
  type StandardZuijiApplicableReason,
} from './zuiji-determination';
import { computeTotalRemunerationFromPayroll, computeFixedWageFromPayroll, computeVariableWageFromPayroll } from './fixed-wage';
import type { PreviousGrades } from './zuiji-determination';

export const ANNUAL_AVERAGE_PERIOD_MONTH_COUNT = 12;

export interface AnnualAverageMonthInput {
  yyyyMm: string;
  paymentBaseDays: number;
  payroll: PayrollData;
}

export interface AnnualAverageCalculationResult {
  periodMonthKeys: string[];
  usedMonths: Array<{
    yyyyMm: string;
    paymentBaseDays: number;
    remuneration: number;
  }>;
  totalRemuneration: number;
  divisor: number;
  averageRemuneration: number;
  grades: ResolvedStandardRemuneration;
}

export type AnnualAverageCalculationOutcome =
  | { kind: 'calculated'; result: AnnualAverageCalculationResult }
  | { kind: 'invalid'; reason: 'no_eligible_months' | 'grade_not_found'; totalRemuneration: number };

/** 7月算定 yyyyMm から「前年7月〜当年6月」の月キーを生成 */
export function buildAnnualAveragePeriodMonthKeys(teijiYyyyMm: string): string[] {
  const keys: string[] = [];
  for (let i = ANNUAL_AVERAGE_PERIOD_MONTH_COUNT; i >= 1; i--) {
    keys.push(addMonths(teijiYyyyMm, -i));
  }
  return keys;
}

/**
 * 年間平均報酬月額 = 対象月の報酬総額合計 ÷ 対象月数
 * 支払基礎日数が基準未満の月は除外。
 * 対象月が1つもない場合は invalid。
 */
export function calculateAnnualAverageRemuneration(
  employmentType: EmploymentType,
  months: readonly AnnualAverageMonthInput[],
  gradeTable: RemunerationGradeTableSet = CURRENT_GRADE_TABLE,
): AnnualAverageCalculationOutcome {
  const minDays = getPaymentBaseDaysThresholds(employmentType).primaryMinDays;

  const usedMonths = months
    .filter((m) => m.paymentBaseDays >= minDays)
    .map((m) => ({
      yyyyMm: m.yyyyMm,
      paymentBaseDays: m.paymentBaseDays,
      remuneration: computeTotalRemunerationFromPayroll(m.payroll),
    }));

  if (usedMonths.length === 0) {
    return { kind: 'invalid', reason: 'no_eligible_months', totalRemuneration: 0 };
  }

  const totalRemuneration = usedMonths.reduce((sum, m) => sum + m.remuneration, 0);
  const divisor = usedMonths.length;
  const averageRemuneration = totalRemuneration / divisor;

  const grades = resolveGradesFromRemuneration(gradeTable, averageRemuneration);
  if (!grades) {
    return { kind: 'invalid', reason: 'grade_not_found', totalRemuneration };
  }

  const periodMonthKeys =
    months.length > 0 ? [...months].map((m) => m.yyyyMm).sort() : [];

  return {
    kind: 'calculated',
    result: {
      periodMonthKeys,
      usedMonths,
      totalRemuneration,
      divisor,
      averageRemuneration,
      grades,
    },
  };
}

/** 定時決定等級（比較元） */
export interface AnnualAverageScreeningInput {
  teijiHealthGrade: number;
  teijiPensionGrade: number;
}

export type AnnualAverageScreeningOutcome =
  | { kind: 'not_candidate'; reason: 'calculation_invalid'; detail: AnnualAverageCalculationOutcome }
  | {
      kind: 'not_candidate';
      reason: 'insufficient_grade_change';
      healthDiff: number;
      pensionDiff: number;
    }
  | {
      kind: 'candidate';
      healthDiff: number;
      pensionDiff: number;
      applicabilityReasons: StandardZuijiApplicableReason[];
      annualAverage: AnnualAverageCalculationResult;
    };

/**
 * 定時決定等級 vs 年間平均等級のスクリーニング。
 * 等級差判定は随時改定と同じ（通常2等級以上、表上下限は1等級で可）。
 */
export function screenAnnualAverageCandidate(
  employmentType: EmploymentType,
  teijiGrades: AnnualAverageScreeningInput,
  months: readonly AnnualAverageMonthInput[],
  options?: {
    minGradeDifference?: number;
    gradeTable?: RemunerationGradeTableSet;
  },
): AnnualAverageScreeningOutcome {
  const gradeTable = options?.gradeTable ?? CURRENT_GRADE_TABLE;
  const minGradeDifference = options?.minGradeDifference ?? 2;

  const calc = calculateAnnualAverageRemuneration(employmentType, months, gradeTable);
  if (calc.kind !== 'calculated') {
    return { kind: 'not_candidate', reason: 'calculation_invalid', detail: calc };
  }

  const healthDiff = gradeDifference(
    teijiGrades.teijiHealthGrade,
    calc.result.grades.health.grade,
  );
  const pensionDiff = gradeDifference(
    teijiGrades.teijiPensionGrade,
    calc.result.grades.pension.grade,
  );

  const limits = getGradeTableLimits(gradeTable);
  const applicability = evaluateStandardZuijiApplicability(
    {
      healthGrade: teijiGrades.teijiHealthGrade,
      pensionGrade: teijiGrades.teijiPensionGrade,
    },
    calc.result.grades,
    limits,
    minGradeDifference,
  );

  if (!applicability.applicable) {
    return {
      kind: 'not_candidate',
      reason: 'insufficient_grade_change',
      healthDiff,
      pensionDiff,
    };
  }

  return {
    kind: 'candidate',
    healthDiff,
    pensionDiff,
    applicabilityReasons: applicability.reasons,
    annualAverage: calc.result,
  };
}

/** 随時改定: 固定的3ヶ月 + 非固定的12ヶ月の参照窓 */
export const ZUIJI_ANNUAL_FIXED_MONTH_COUNT = 3;
export const ZUIJI_ANNUAL_VARIABLE_MONTH_COUNT = 12;

export interface ZuijiAnnualAverageMonthWindows {
  changeMonthYyyyMm: string;
  fixedAfterKeys: string[];     // M, M+1, M+2
  variableWindowKeys: string[]; // M-9 〜 M+2
}

/** 昇給（降給）月 M から随時改定用年間平均の参照月キーを生成 */
export function buildZuijiAnnualAverageMonthWindows(
  changeMonthYyyyMm: string,
): ZuijiAnnualAverageMonthWindows {
  const fixedAfterKeys = [
    changeMonthYyyyMm,
    addMonths(changeMonthYyyyMm, 1),
    addMonths(changeMonthYyyyMm, 2),
  ];

  const variableWindowKeys: string[] = [];
  for (let i = 9; i >= 1; i--) {
    variableWindowKeys.push(addMonths(changeMonthYyyyMm, -i));
  }
  variableWindowKeys.push(...fixedAfterKeys);

  return { changeMonthYyyyMm, fixedAfterKeys, variableWindowKeys };
}

/** tryZuiji から changeMonth を渡す場合の全ロード範囲（M-9 〜 M+2） */
export function buildZuijiAnnualAverageLoadKeys(changeMonthYyyyMm: string): string[] {
  return buildZuijiAnnualAverageMonthWindows(changeMonthYyyyMm).variableWindowKeys;
}

interface EligibleMonthAmount {
  yyyyMm: string;
  paymentBaseDays: number;
  amount: number;
}

function averageEligibleMonths(
  employmentType: EmploymentType,
  months: readonly AnnualAverageMonthInput[],
  targetKeys: readonly string[],
  pickAmount: (payroll: PayrollData) => number,
): { usedMonths: EligibleMonthAmount[]; average: number } | null {
  const minDays = getPaymentBaseDaysThresholds(employmentType).primaryMinDays;
  const byKey = new Map(months.map((m) => [m.yyyyMm, m]));

  const usedMonths: EligibleMonthAmount[] = [];
  for (const key of targetKeys) {
    const month = byKey.get(key);
    if (!month || month.paymentBaseDays < minDays) continue;
    usedMonths.push({
      yyyyMm: key,
      paymentBaseDays: month.paymentBaseDays,
      amount: pickAmount(month.payroll),
    });
  }

  if (usedMonths.length === 0) return null;

  const total = usedMonths.reduce((sum, m) => sum + m.amount, 0);
  return { usedMonths, average: total / usedMonths.length };
}

export interface ZuijiAnnualAverageCalculationResult {
  windows: ZuijiAnnualAverageMonthWindows;
  fixedAfterAverage: {
    usedMonths: EligibleMonthAmount[];
    average: number;
  };
  variableWindowAverage: {
    usedMonths: EligibleMonthAmount[];
    average: number;
  };
  /** 年間平均報酬月額 = 固定平均 + 非固定平均 */
  averageRemuneration: number;
  grades: ResolvedStandardRemuneration;
}

export type ZuijiAnnualAverageCalculationOutcome =
  | { kind: 'calculated'; result: ZuijiAnnualAverageCalculationResult }
  | {
      kind: 'invalid';
      reason: 'no_eligible_fixed_months' | 'no_eligible_variable_months' | 'grade_not_found';
    };

/** 随時改定用年間平均報酬月額 → 等級 */
export function calculateZuijiAnnualAverageRemuneration(
  employmentType: EmploymentType,
  changeMonthYyyyMm: string,
  months: readonly AnnualAverageMonthInput[],
  gradeTable: RemunerationGradeTableSet = CURRENT_GRADE_TABLE,
): ZuijiAnnualAverageCalculationOutcome {
  const windows = buildZuijiAnnualAverageMonthWindows(changeMonthYyyyMm);

  const fixedAfterAverage = averageEligibleMonths(
    employmentType,
    months,
    windows.fixedAfterKeys,
    computeFixedWageFromPayroll,
  );
  if (!fixedAfterAverage) {
    return { kind: 'invalid', reason: 'no_eligible_fixed_months' };
  }

  const variableWindowAverage = averageEligibleMonths(
    employmentType,
    months,
    windows.variableWindowKeys,
    computeVariableWageFromPayroll,
  );
  if (!variableWindowAverage) {
    return { kind: 'invalid', reason: 'no_eligible_variable_months' };
  }

  const averageRemuneration =
    fixedAfterAverage.average + variableWindowAverage.average;

  const grades = resolveGradesFromRemuneration(gradeTable, averageRemuneration);
  if (!grades) {
    return { kind: 'invalid', reason: 'grade_not_found' };
  }

  return {
    kind: 'calculated',
    result: {
      windows,
      fixedAfterAverage,
      variableWindowAverage,
      averageRemuneration,
      grades,
    },
  };
}

/** 条件(3): 現在 vs 年間平均 — 1等級以上（健保・厚年いずれか） */
export function meetsCurrentVsAnnualOneGradeRule(
  current: PreviousGrades,
  annualGrades: ResolvedStandardRemuneration,
): boolean {
  const healthDiff = gradeDifference(current.healthGrade, annualGrades.health.grade);
  const pensionDiff = gradeDifference(current.pensionGrade, annualGrades.pension.grade);
  return healthDiff >= 1 || pensionDiff >= 1;
}

export type ZuijiAnnualAverageAdoptionReason =
  | 'condition1_normal_zuiji_applicable' // (1) は呼び出し側で applicable 確認済み
  | 'condition2_normal_vs_annual_two_grades'
  | 'condition3_current_vs_annual_one_grade';

export type ZuijiAnnualAverageScreeningOutcome =
  | {
      kind: 'not_candidate';
      reason:
        | 'calculation_invalid'
        | 'condition2_insufficient_grade_change'
        | 'condition3_insufficient_grade_change';
      detail?: ZuijiAnnualAverageCalculationOutcome;
      diffs?: {
        currentVsNormal: { health: number; pension: number };
        normalVsAnnual: { health: number; pension: number };
        currentVsAnnual: { health: number; pension: number };
      };
    }
  | {
      kind: 'candidate';
      reasons: ZuijiAnnualAverageAdoptionReason[];
      normalZuijiGrades: ResolvedStandardRemuneration;
      annualAverage: ZuijiAnnualAverageCalculationResult;
      diffs: {
        currentVsNormal: { health: number; pension: number };
        normalVsAnnual: { health: number; pension: number };
        currentVsAnnual: { health: number; pension: number };
      };
    };

/**
 * 随時改定における年間平均採択候補の判定。
 * 前提: determineStandardZuiji が applicable（= 条件(1) 充足）
 */
export function screenZuijiAnnualAverageCandidate(
  employmentType: EmploymentType,
  currentGrades: PreviousGrades,
  normalZuijiGrades: ResolvedStandardRemuneration,
  changeMonthYyyyMm: string,
  months: readonly AnnualAverageMonthInput[],
  options?: {
    minGradeDifferenceForCondition2?: number;
    gradeTable?: RemunerationGradeTableSet;
  },
): ZuijiAnnualAverageScreeningOutcome {
  const gradeTable = options?.gradeTable ?? CURRENT_GRADE_TABLE;
  const minGradeDiff = options?.minGradeDifferenceForCondition2 ?? 2;

  const calc = calculateZuijiAnnualAverageRemuneration(
    employmentType,
    changeMonthYyyyMm,
    months,
    gradeTable,
  );
  if (calc.kind !== 'calculated') {
    return { kind: 'not_candidate', reason: 'calculation_invalid', detail: calc };
  }

  const currentVsNormal = {
    health: gradeDifference(currentGrades.healthGrade, normalZuijiGrades.health.grade),
    pension: gradeDifference(currentGrades.pensionGrade, normalZuijiGrades.pension.grade),
  };
  const normalVsAnnual = {
    health: gradeDifference(normalZuijiGrades.health.grade, calc.result.grades.health.grade),
    pension: gradeDifference(normalZuijiGrades.pension.grade, calc.result.grades.pension.grade),
  };
  const currentVsAnnual = {
    health: gradeDifference(currentGrades.healthGrade, calc.result.grades.health.grade),
    pension: gradeDifference(currentGrades.pensionGrade, calc.result.grades.pension.grade),
  };

  // 条件(2): 通常随時 vs 年間平均 — 2等級（表上下限1等級可）
  const limits = getGradeTableLimits(gradeTable);
  const condition2 = evaluateStandardZuijiApplicability(
    {
      healthGrade: normalZuijiGrades.health.grade,
      pensionGrade: normalZuijiGrades.pension.grade,
    },
    calc.result.grades,
    limits,
    minGradeDiff,
  );
  if (!condition2.applicable) {
    return {
      kind: 'not_candidate',
      reason: 'condition2_insufficient_grade_change',
      diffs: { currentVsNormal, normalVsAnnual, currentVsAnnual },
    };
  }

  // 条件(3): 現在 vs 年間平均 — 1等級以上
  if (!meetsCurrentVsAnnualOneGradeRule(currentGrades, calc.result.grades)) {
    return {
      kind: 'not_candidate',
      reason: 'condition3_insufficient_grade_change',
      diffs: { currentVsNormal, normalVsAnnual, currentVsAnnual },
    };
  }

  return {
    kind: 'candidate',
    reasons: [
      'condition1_normal_zuiji_applicable',
      'condition2_normal_vs_annual_two_grades',
      'condition3_current_vs_annual_one_grade',
    ],
    normalZuijiGrades,
    annualAverage: calc.result,
    diffs: { currentVsNormal, normalVsAnnual, currentVsAnnual },
  };
}