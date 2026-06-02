import type { AssociationRateTableSet, PrefectureCode } from '../../social-insurance/insurance-rates/association/types';

export function resolvePrefectureCodeFromAddress(
    address1: string,
    table: AssociationRateTableSet,
): PrefectureCode | null {
    const s = address1.trim();
    if (!s) return null;

    const rows = [...table.prefectures].sort(
    (a, b) => b.prefectureName.length - a.prefectureName.length,
    );
    const hit = rows.find((r) => s.startsWith(r.prefectureName));
    if (!hit) return null;

    return hit.prefectureCode;
}