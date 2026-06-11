import type { EmployeeLeaveType } from '../../employee-document';
import { addMonths } from '../monthly/social-insurance-data.util';
import {
  dateToYyyyMm,
  dayAfter,
  type LeavePeriodInput,
} from '../premium/leave-premium-exemption';
import { CURRENT_GRADE_TABLE, gradeDifference } from './grade-table';
import type { RemunerationGradeTableSet, ResolvedStandardRemuneration } from './grade-table';
import type { EmploymentType } from './payment-base-days';
import {
  classifyPaymentBaseDaysTier,
  getPaymentBaseDaysThresholds,
} from './payment-base-days';
import { calculateGradesForLeaveReturn } from './remuneration-average';
import type { MonthlyRemunerationSource } from './remuneration-month-input';
import {
  evaluateStandardZuijiApplicability,
  getGradeTableLimits,
  type PreviousGrades,
  type StandardZuijiApplicability,
} from './zuiji-determination';
import type { GradesFromMonthsOutcome } from './remuneration-average';

export const LEAVE_RETURN_MEASUREMENT_MONTH_COUNT = 3;
export const LEAVE_RETURN_MIN_GRADE_DIFFERENCE = 1;

export function returnStartYyyyMmFromLeaveEnd(endAt: Date): string {
  return dateToYyyyMm(dayAfter(endAt));
}

export function buildLeaveReturnMeasurementMonthKeys(returnStartYyyyMm: string): string[] {
  return [
    returnStartYyyyMm,
    addMonths(returnStartYyyyMm, 1),
    addMonths(returnStartYyyyMm, 2),
  ];
}

/** 復職後3カ月目（測定完了月） */
export function leaveReturnScreeningYyyyMm(returnStartYyyyMm: string): string {
  return addMonths(returnStartYyyyMm, LEAVE_RETURN_MEASUREMENT_MONTH_COUNT - 1);
}

/** 改定適用月（測定3カ月の翌月） */
export function leaveReturnEffectiveYyyyMm(returnStartYyyyMm: string): string {
  return addMonths(returnStartYyyyMm, LEAVE_RETURN_MEASUREMENT_MONTH_COUNT);
}

export function leaveTypeLabel(type: EmployeeLeaveType): string {
  return type === 'maternity' ? '産前産後休業' : '育児休業等';
}

export function satisfiesLeaveReturnPaymentBaseDaysCondition(
  employmentType: EmploymentType,
  months: readonly MonthlyRemunerationSource[],
): boolean {
  if (months.length !== LEAVE_RETURN_MEASUREMENT_MONTH_COUNT) {
    return false;
  }

  const hasPrimary = months.some(
    (m) => classifyPaymentBaseDaysTier(employmentType, m.paymentBaseDays) === 'primary',
  );
  if (hasPrimary) {
    return true;
  }

  if (employmentType === 'short-time-worker') {
    return months.some(
      (m) => classifyPaymentBaseDaysTier(employmentType, m.paymentBaseDays) === 'secondary',
    );
  }

  return false;
}

export type LeaveReturnRemunerationDeterminationOutcome =
  | {
      kind: 'applicable';
      average: Extract<GradesFromMonthsOutcome, { kind: 'calculated' }>['average'];
      grades: ResolvedStandardRemuneration;
      applicability: StandardZuijiApplicability;
      healthDiff: number;
      pensionDiff: number;
    }
  | {
      kind: 'not_applicable';
      reason:
        | 'requires_three_months'
        | 'insufficient_payment_base_days'
        | 'grade_not_found'
        | 'insufficient_grade_change';
      preview?: GradesFromMonthsOutcome;
    };

/**
 * 産休・育休明けの標準報酬月額調整（随時改定の特例）。
 * 自動適用はせず、呼び出し側で同意確認アラートを行う。
 */
export function determineLeaveReturnRemuneration(
  employmentType: EmploymentType,
  months: readonly MonthlyRemunerationSource[],
  previous: PreviousGrades,
  options?: {
    minGradeDifference?: number;
    gradeTable?: RemunerationGradeTableSet;
  },
): LeaveReturnRemunerationDeterminationOutcome {
  if (months.length !== LEAVE_RETURN_MEASUREMENT_MONTH_COUNT) {
    return { kind: 'not_applicable', reason: 'requires_three_months' };
  }

  if (!satisfiesLeaveReturnPaymentBaseDaysCondition(employmentType, months)) {
    return { kind: 'not_applicable', reason: 'insufficient_payment_base_days' };
  }

  const gradeTable = options?.gradeTable ?? CURRENT_GRADE_TABLE;
  const base = calculateGradesForLeaveReturn(employmentType, months, gradeTable);

  if (base.kind === 'continue_previous') {
    return {
      kind: 'not_applicable',
      reason: 'insufficient_payment_base_days',
      preview: base,
    };
  }
  if (base.kind === 'invalid') {
    return { kind: 'not_applicable', reason: 'grade_not_found', preview: base };
  }

  const limits = getGradeTableLimits(gradeTable);
  const minGradeDifference = options?.minGradeDifference ?? LEAVE_RETURN_MIN_GRADE_DIFFERENCE;
  const applicability = evaluateStandardZuijiApplicability(
    previous,
    base.grades,
    limits,
    minGradeDifference,
  );

  const healthDiff = gradeDifference(previous.healthGrade, base.grades.health.grade);
  const pensionDiff = gradeDifference(previous.pensionGrade, base.grades.pension.grade);

  if (!applicability.applicable) {
    return {
      kind: 'not_applicable',
      reason: 'insufficient_grade_change',
      preview: base,
    };
  }

  return {
    kind: 'applicable',
    average: base.average,
    grades: base.grades,
    applicability,
    healthDiff,
    pensionDiff,
  };
}

export interface LeaveReturnScreeningTarget {
  leaveType: EmployeeLeaveType;
  leaveEndYyyyMm: string;
  returnStartYyyyMm: string;
  screeningYyyyMm: string;
  effectiveYyyyMm: string;
  measurementMonthKeys: string[];
}

export function findLeaveReturnScreeningTargets(
  yyyyMm: string,
  leaveRecords: readonly LeavePeriodInput[],
): LeaveReturnScreeningTarget[] {
  const targets: LeaveReturnScreeningTarget[] = [];

  for (const leave of leaveRecords) {
    if (!leave.endAt) {
      continue;
    }

    const returnStartYyyyMm = returnStartYyyyMmFromLeaveEnd(leave.endAt);
    const screeningYyyyMm = leaveReturnScreeningYyyyMm(returnStartYyyyMm);
    if (yyyyMm !== screeningYyyyMm) {
      continue;
    }

    targets.push({
      leaveType: leave.type,
      leaveEndYyyyMm: dateToYyyyMm(leave.endAt),
      returnStartYyyyMm,
      screeningYyyyMm,
      effectiveYyyyMm: leaveReturnEffectiveYyyyMm(returnStartYyyyMm),
      measurementMonthKeys: buildLeaveReturnMeasurementMonthKeys(returnStartYyyyMm),
    });
  }

  return targets;
}

export function buildLeaveReturnRemunerationNotificationBody(input: {
  employeeName: string;
  leaveType: EmployeeLeaveType;
  leaveEndYyyyMm: string;
  effectiveYyyyMm: string;
  currentGrades: PreviousGrades;
  proposedGrades: ResolvedStandardRemuneration;
  averageRemuneration: number;
  healthDiff: number;
  pensionDiff: number;
  employmentType: EmploymentType;
}): string {
  const thresholds = getPaymentBaseDaysThresholds(input.employmentType);
  const leaveLabel = leaveTypeLabel(input.leaveType);

  return (
    `${input.employeeName}様は${leaveLabel}（終了: ${input.leaveEndYyyyMm}）明けの標準報酬月額調整候補です。` +
    `復職後3カ月の報酬平均 ${Math.round(input.averageRemuneration).toLocaleString()}円に基づく試算等級は` +
    `健康保険 ${input.proposedGrades.health.grade}等級 / 厚生年金 ${input.proposedGrades.pension.grade}等級` +
    `（現在 ${input.currentGrades.healthGrade}/${input.currentGrades.pensionGrade}等級、` +
    `差 ${input.healthDiff}/${input.pensionDiff}）です。` +
    `${input.effectiveYyyyMm} からの適用見込み。` +
    `支払基礎日数は ${thresholds.primaryMinDays}日以上の月を平均に含め、` +
    `3カ月のうち少なくとも1カ月が基準を満たす必要があります。` +
    `本人同意のうえ届出を検討してください。`
  );
}

export function buildLeaveReturnRemunerationDedupeKey(
  eid: string,
  leaveEndYyyyMm: string,
): string {
  return `${eid}_${leaveEndYyyyMm}_leave_return_remuneration`;
}
