import type { PayrollData } from '../../monthly-document';
import { computeFixedWageFromPayroll } from './fixed-wage';
import {
  CURRENT_GRADE_TABLE,
  resolveGradesFromRemuneration,
} from './grade-table';
import type { RemunerationGradeTableSet, ResolvedStandardRemuneration } from './grade-table';

export type InitialDeterminationOutcome =
  | {
      kind: 'calculated';
      remuneration: number;
      grades: ResolvedStandardRemuneration;
    }
  | { kind: 'invalid'; reason: 'grade_not_found'; remuneration: number };

/**
 * 資格取得時の初回決定: 入社月（見込み）の固定的賃金 → 報酬月額 → 等級。
 */
export function determineInitial(
  payroll: PayrollData,
  gradeTable: RemunerationGradeTableSet = CURRENT_GRADE_TABLE,
): InitialDeterminationOutcome {
  const remuneration = computeFixedWageFromPayroll(payroll);
  const grades = resolveGradesFromRemuneration(gradeTable, remuneration);

  if (!grades) {
    return { kind: 'invalid', reason: 'grade_not_found', remuneration };
  }

  return { kind: 'calculated', remuneration, grades };
}