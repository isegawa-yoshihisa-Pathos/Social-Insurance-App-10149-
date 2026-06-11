import { RemunerationGradeRow, RemunerationGradeTableSet, GradeLookupResult, ResolvedStandardRemuneration } from './types';

export function roundRemunerationForGrade(remuneration: number): number {
    return Math.floor(remuneration / 1000) * 1000;
}
  
function findGrade(
    rows: readonly RemunerationGradeRow[],
    remuneration: number,
): GradeLookupResult | null {
    const row = rows.find(
    (r) => remuneration >= r.minRemuneration && remuneration < r.maxRemuneration,
    );
    if (!row) return null;
    return {
    grade: row.grade,
    standardRemuneration: row.standardRemuneration,
    minRemuneration: row.minRemuneration,
    maxRemuneration: row.maxRemuneration,
    };
}

export function resolveGradeFromStandardAmount(
    rows: readonly RemunerationGradeRow[],
    standardAmount: number,
): number | null {
    const row = rows.find((r) => r.standardRemuneration === standardAmount);
    return row?.grade ?? null;
}

export function resolveGradesFromRemuneration(
    table: RemunerationGradeTableSet,
    rawRemuneration: number,
): ResolvedStandardRemuneration | null {
    const remuneration = roundRemunerationForGrade(rawRemuneration);
    const health = findGrade(table.health, remuneration);
    const pension = findGrade(table.pension, remuneration);
    if (!health || !pension) return null;
    return { remuneration, health, pension };
}

export function resolveStandardRemunerationFromRemuneration(
    rows: readonly RemunerationGradeRow[],
    rawStandardAmount: number,
): number{
    const remuneration = roundRemunerationForGrade(rawStandardAmount);
    const row = rows.find(
        (r) => remuneration >= r.minRemuneration && remuneration < r.maxRemuneration,
        );
    if (!row) throw new Error('等級表に該当しない標準報酬月額です。');
    return row.standardRemuneration;
}

export function gradeDifference(a: number, b: number): number {
    return Math.abs(a - b);
}