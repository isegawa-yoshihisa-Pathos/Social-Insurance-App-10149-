import { CURRENT_GRADE_TABLE, type RemunerationGradeTableSet } from './grade-table';
import { calculateGradesFromMonths, type GradesFromMonthsOutcome } from './remuneration-average';
import type { EmploymentType, MonthPaymentBaseInput } from './payment-base-days';

export type TeijiDeterminationOutcome = GradesFromMonthsOutcome;

/**
 * 定時決定（算定基礎届）: 4・5・6月など、呼び出し側が渡した月で平均 → 等級。
 * 等級差による適用可否の判定は行わない。
 */
export function determineTeiji(
  employmentType: EmploymentType,
  months: readonly MonthPaymentBaseInput[],
  gradeTable?: RemunerationGradeTableSet,
): TeijiDeterminationOutcome {
  if (!gradeTable) {
    gradeTable = CURRENT_GRADE_TABLE;
  }
  return calculateGradesFromMonths(employmentType, months, gradeTable);
}