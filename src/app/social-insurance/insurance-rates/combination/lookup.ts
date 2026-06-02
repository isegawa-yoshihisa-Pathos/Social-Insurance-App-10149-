import type {
    CombinationRegistryEntry,
    ResolvedCombinationRates,
} from './types';

export function resolveCombinationRates(
    registry: CombinationRegistryEntry,
    targetDate: string,
): ResolvedCombinationRates | null {
    const eligible = registry.tables.filter((t) => t.effectiveFrom <= targetDate);
    if (eligible.length === 0) return null;

    const best = eligible.sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom),
    )[0];

    return {
    combinationName: best.combinationName,
    healthInsuranceRate: best.healthInsuranceRate,
    careInsuranceRate: best.careInsuranceRate,
    pensionInsuranceRate: best.pensionInsuranceRate,
    effectiveFrom: best.effectiveFrom,
    label: best.label,
    };
}

export function findCombinationRegistry(
    registries: readonly CombinationRegistryEntry[],
    name: string,
): CombinationRegistryEntry | null {
    return registries.find((r) => r.combinationName === name) ?? null;
}