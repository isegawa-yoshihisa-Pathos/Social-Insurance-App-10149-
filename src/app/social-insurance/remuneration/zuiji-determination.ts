import { CURRENT_GRADE_TABLE, gradeDifference } from './grade-table';
import type { RemunerationGradeTableSet, ResolvedStandardRemuneration } from './grade-table';
import {
  calculateGradesForZuiji,
  type GradesFromMonthsOutcome,
} from './remuneration-average';
import type { EmploymentType, MonthPaymentBaseInput } from './payment-base-days';
import type { MonthlyRemunerationSource } from './remuneration-month-input';

export interface PreviousGrades {
  healthGrade: number;
  pensionGrade: number;
}

export interface GradeTableLimits {
  healthMinGrade: number;
  healthMaxGrade: number;
  pensionMinGrade: number;
  pensionMaxGrade: number;
}

export function getGradeTableLimits(table: RemunerationGradeTableSet): GradeTableLimits {
  const health = table.health;
  const pension = table.pension;
  return {
    healthMinGrade: health[0].grade,
    healthMaxGrade: health[health.length - 1].grade,
    pensionMinGrade: pension[0].grade,
    pensionMaxGrade: pension[pension.length - 1].grade,
  };
}

export type StandardZuijiApplicableReason =
  | 'two_or_more_grades'
  | 'health_lower_limit_one_grade'
  | 'health_upper_limit_one_grade'
  | 'pension_lower_limit_one_grade'
  | 'pension_upper_limit_one_grade';

export interface StandardZuijiApplicability {
  applicable: boolean;
  reasons: StandardZuijiApplicableReason[];
}

export function evaluateStandardZuijiApplicability(
  previous: PreviousGrades,
  grades: ResolvedStandardRemuneration,
  limits: GradeTableLimits,
  minGradeDifference = 2,
): StandardZuijiApplicability {
  const reasons: StandardZuijiApplicableReason[] = [];

  const newHealth = grades.health.grade;
  const newPension = grades.pension.grade;
  const healthDiff = gradeDifference(previous.healthGrade, newHealth);
  const pensionDiff = gradeDifference(previous.pensionGrade, newPension);

  if (healthDiff >= minGradeDifference || pensionDiff >= minGradeDifference) {
    reasons.push('two_or_more_grades');
  }

  if (healthDiff === 1) {
    if (previous.healthGrade === limits.healthMinGrade && newHealth === previous.healthGrade + 1) {
      reasons.push('health_lower_limit_one_grade');
    }
    if (previous.healthGrade === limits.healthMaxGrade && newHealth === previous.healthGrade - 1) {
      reasons.push('health_upper_limit_one_grade');
    }
  }

  if (pensionDiff === 1) {
    if (previous.pensionGrade === limits.pensionMinGrade && newPension === previous.pensionGrade + 1) {
      reasons.push('pension_lower_limit_one_grade');
    }
    if (previous.pensionGrade === limits.pensionMaxGrade && newPension === previous.pensionGrade - 1) {
      reasons.push('pension_upper_limit_one_grade');
    }
  }

  return {
    applicable: reasons.length > 0,
    reasons: [...new Set(reasons)],
  };
}

type CalculatedGrades = Extract<GradesFromMonthsOutcome, { kind: 'calculated' }>;

export type StandardZuijiDeterminationOutcome =
  | (Omit<CalculatedGrades, 'kind'> & {
      kind: 'applicable';
      applicability: StandardZuijiApplicability;
    })
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
 * 通常の随時改定（月額変更届）。
 * 固定的賃金変動・3ヶ月窓のトリガーは呼び出し側。
 */
export function determineStandardZuiji(
  employmentType: EmploymentType,
  months: readonly MonthlyRemunerationSource[],
  previous: PreviousGrades,
  options?: {
    minGradeDifference?: number;
    gradeTable?: RemunerationGradeTableSet;
  },
): StandardZuijiDeterminationOutcome {
  if (months.length !== 3) {
    return { kind: 'not_applicable', reason: 'requires_three_months' };
  }

  const gradeTable = options?.gradeTable ?? CURRENT_GRADE_TABLE;
  const base = calculateGradesForZuiji(employmentType, months, gradeTable);

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
  const applicability = evaluateStandardZuijiApplicability(
    previous,
    base.grades,
    limits,
    options?.minGradeDifference ?? 2,
  );

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
  };
}