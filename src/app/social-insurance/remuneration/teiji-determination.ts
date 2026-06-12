import { CURRENT_GRADE_TABLE, type RemunerationGradeTableSet } from './grade-table';
import { calculateGradesFromMonths, type GradesFromMonthsOutcome } from './remuneration-average';
import type { EmploymentType } from './payment-base-days';
import type { MonthlyRemunerationSource } from './remuneration-month-input';

export type TeijiDeterminationOutcome = GradesFromMonthsOutcome;

/**
 * 定時決定（算定基礎届）: 4・5・6月など、呼び出し側が渡した月で平均 → 等級。
 * 報酬月額は固定的賃金・非固定的賃金・賞与関連報酬を含む。
 * 等級差による適用可否の判定は行わない。
 */
export function determineTeiji(
  employmentType: EmploymentType,
  months: readonly MonthlyRemunerationSource[],
  gradeTable?: RemunerationGradeTableSet,
): TeijiDeterminationOutcome {
  if (!gradeTable) {
    gradeTable = CURRENT_GRADE_TABLE;
  }
  return calculateGradesFromMonths(employmentType, months, gradeTable);
}