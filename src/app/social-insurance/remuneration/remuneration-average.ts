import { resolveGradesFromRemuneration } from './grade-table';
import type { RemunerationGradeTableSet, ResolvedStandardRemuneration } from './grade-table';
import {
    selectMonthsForRemunerationAverageSelection,
    selectMonthsForZuijiAverage,
    type EmploymentType,
    type MonthPaymentBaseInput,
    type RemunerationAverageSelectionOutcome,
    type RemunerationAverageSelectionResult,
} from './payment-base-days';

export type GradesFromMonthsOutcome =
    | {
        kind: 'calculated';
        average: RemunerationAverageSelectionResult;
        grades: ResolvedStandardRemuneration;
    }
    | {
        kind: 'continue_previous';
        selection: Extract<RemunerationAverageSelectionOutcome, { kind: 'continue_previous' }>;
    }
    | {
        kind: 'invalid';
        reason: 'grade_not_found';
        selection: RemunerationAverageSelectionResult;
    };

function gradesFromSelection(
    selection: RemunerationAverageSelectionOutcome,
    gradeTable: RemunerationGradeTableSet,
): GradesFromMonthsOutcome {
    if (selection.kind === 'continue_previous') {
        return { kind: 'continue_previous', selection };
    }
    const grades = resolveGradesFromRemuneration(gradeTable, selection.result.averageRemuneration);
    if (!grades) {
        return { kind: 'invalid', reason: 'grade_not_found', selection: selection.result };
    }
    return { kind: 'calculated', average: selection.result, grades };
}

export function calculateGradesFromMonths(
    employmentType: EmploymentType,
    months: readonly MonthPaymentBaseInput[],
    gradeTable: RemunerationGradeTableSet,
): GradesFromMonthsOutcome {
    const selection = selectMonthsForRemunerationAverageSelection(employmentType, months);
    return gradesFromSelection(selection, gradeTable);
}

export function calculateGradesForZuiji(
    employmentType: EmploymentType,
    months: readonly MonthPaymentBaseInput[],
    gradeTable: RemunerationGradeTableSet,
): GradesFromMonthsOutcome {
    const selection = selectMonthsForZuijiAverage(employmentType, months);
    return gradesFromSelection(selection, gradeTable);
}